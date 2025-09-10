"use client";

import { useMemo } from "react";
import { GenericStringStorage } from "../../fhevm/GenericStringStorage";
import { FhevmInstance } from "../../fhevm/fhevmTypes";
import { useFHEDecrypt } from "./fhevm/useFHEDecrypt";
import { ethers } from "ethers";
import type { Contract } from "~~/utils/scaffold-eth/contract";

type FHECounterInfo = Contract<"FHECounter"> & { chainId?: number };

export type ClearValueType = {
  handle: string;
  clear: string | bigint | boolean;
};

export const useFHECounterDecrypt = (params: {
  fheCounter: FHECounterInfo | undefined;
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.Signer | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  chainId: number | undefined;
  countHandle: string | undefined;
}) => {
  const { fheCounter, instance, ethersSigner, fhevmDecryptionSignatureStorage, chainId, countHandle } = params;

  const requests = useMemo(() => {
    if (!fheCounter?.address || !countHandle || countHandle === ethers.ZeroHash) return undefined;
    return [{ handle: countHandle, contractAddress: fheCounter?.address } as const];
  }, [fheCounter?.address, countHandle]);

  const { canDecrypt, decrypt, isDecrypting, message, results, setMessage } = useFHEDecrypt({
    instance,
    ethersSigner,
    fhevmDecryptionSignatureStorage,
    chainId,
    requests,
  });

  const clearCount = useMemo(() => {
    if (!countHandle) return undefined;
    if (countHandle === ethers.ZeroHash) return { handle: countHandle, clear: BigInt(0) };
    const clear = results[countHandle];
    if (typeof clear === "undefined") return undefined;
    return { handle: countHandle, clear } as ClearValueType;
  }, [countHandle, results]);

  const isDecrypted = Boolean(countHandle && clearCount?.handle === countHandle);

  return {
    canDecrypt,
    decryptCountHandle: decrypt,
    isDecrypted,
    isDecrypting,
    clearCount,
    message,
    setMessage,
  } as const;
};
