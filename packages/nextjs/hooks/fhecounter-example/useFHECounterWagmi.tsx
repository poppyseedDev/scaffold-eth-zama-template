"use client";

import { useCallback, useMemo, useState } from "react";
import { useFHEDecrypt } from "../fhevm/useFHEDecrypt";
import { buildParamsFromAbi, getEncryptionMethod, useFHEEncryption } from "../fhevm/useFHEEncryption";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "../scaffold-eth";
import { useWagmiEthers } from "../wagmi/useWagmiEthers";
import { GenericStringStorage } from "~~/fhevm/GenericStringStorage";
import { FhevmInstance } from "~~/fhevm/fhevmTypes";
import type { AllowedChainIds } from "~~/utils/scaffold-eth/networks";

/**
 * useFHECounterWagmi - Minimal FHE Counter hook for Wagmi devs
 *
 * What it does:
 * - Reads the current encrypted counter handle via useScaffoldReadContract
 * - Decrypts the handle on-demand with useFHEDecrypt
 * - Encrypts inputs and writes increment/decrement with useScaffoldWriteContract
 *
 * Pass your FHEVM instance and a simple key-value storage for the decryption signature.
 * That's it. Everything else is handled for you.
 */
export const useFHECounterWagmi = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, fhevmDecryptionSignatureStorage, initialMockChains } = parameters;

  // Basic Wagmi ↔ Ethers interop (signer + chainId)
  const { chainId, isConnected, ethersSigner } = useWagmiEthers(initialMockChains);
  const allowedChainId = typeof chainId === "number" ? (chainId as AllowedChainIds) : undefined;

  // Contract info (address + abi) for FHECounter
  const { data: fheCounter } = useDeployedContractInfo({ contractName: "FHECounter", chainId: allowedChainId });

  // 1) Read: encrypted handle from getCount()
  const { data: handle } = useScaffoldReadContract({
    contractName: "FHECounter",
    functionName: "getCount",
    chainId: allowedChainId,
    watch: true, // auto-refresh on new blocks
  });

  // 2) Decrypt: prepare a single decrypt request when we have a handle
  const ZERO_HANDLE =
    "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
  const requests = useMemo(() => {
    if (!fheCounter?.address || !handle || handle === ZERO_HANDLE) return undefined;
    return [{ handle: handle as string, contractAddress: fheCounter.address } as const];
  }, [fheCounter?.address, handle]);

  const { canDecrypt, decrypt, isDecrypting, message: decryptMessage, results } = useFHEDecrypt({
    instance,
    ethersSigner,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests,
  });

  // Derived decrypted value (if available)
  const clear = useMemo(() => {
    if (!handle) return undefined;
    if (handle === ZERO_HANDLE) return BigInt(0);
    return results[handle as string] as bigint | undefined;
  }, [handle, results]);
  const isDecrypted = useMemo(() => Boolean(handle && typeof clear !== "undefined"), [handle, clear]);

  // 3) Write: encrypt input and call increment/decrement
  const { encryptWith } = useFHEEncryption({ instance, ethersSigner, contractAddress: fheCounter?.address });
  const { writeContractAsync } = useScaffoldWriteContract({ contractName: "FHECounter" });

  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string>("");

  const canUpdateCounter = useMemo(
    () => Boolean(isConnected && instance && ethersSigner && fheCounter?.address && fheCounter?.abi && !isProcessing),
    [isConnected, instance, ethersSigner, fheCounter?.address, fheCounter?.abi, isProcessing],
  );

  /**
   * updateCounter(+1 | -1)
   * - Encrypts the absolute value using the correct FHE external type
   * - Builds params [encryptedHandle, inputProof]
   * - Sends the tx via Scaffold-ETH write hook
   */
  const updateCounter = useCallback(
    async (delta: number) => {
      if (!canUpdateCounter || !fheCounter?.abi) return;
      if (delta === 0) return;

      const op = delta > 0 ? "increment" : "decrement";
      const valueAbs = Math.abs(delta);

      try {
        setIsProcessing(true);
        setMessage(`Encrypting ${valueAbs} and calling ${op}...`);

        // Figure out which FHE external type the function expects
        const fn = (fheCounter.abi as any[]).find((item: any) => item.type === "function" && item.name === op) as
          | { inputs?: { internalType: string }[] }
          | undefined;
        if (!fn || !fn.inputs || fn.inputs.length === 0) {
          setMessage(`ABI for ${op} not found or has no inputs`);
          return;
        }
        const method = getEncryptionMethod(fn.inputs[0]!.internalType);

        // Build encrypted inputs
        const enc = await encryptWith((builder: any) => {
          (builder as any)[method](valueAbs);
        });
        if (!enc) {
          setMessage("Encryption failed");
          return;
        }

        // Build params aligned with the ABI [externalEuint32, inputProof]
        const params = buildParamsFromAbi(enc, fheCounter.abi as any[], op);

        setMessage("Sending transaction...");
        await writeContractAsync({ functionName: op as any, args: params as any[] });
        setMessage(`${op}(${valueAbs}) sent. Waiting for confirmations...`);
      } catch (e) {
        setMessage(`${op} failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [canUpdateCounter, fheCounter?.abi, encryptWith, writeContractAsync],
  );

  return {
    // Contract info
    contractAddress: fheCounter?.address,

    // Read/Decrypt
    handle: handle as string | undefined,
    clear,
    isDecrypted,
    canDecrypt,
    decryptCountHandle: decrypt,
    isDecrypting,

    // Write
    canUpdateCounter,
    updateCounter,
    isProcessing,

    // UX helpers
    message: decryptMessage || message,

    // Wagmi basics
    chainId,
    isConnected,
    ethersSigner,
  } as const;
};
