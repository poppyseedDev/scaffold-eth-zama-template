"use client";

import { useMemo, useState } from "react";
import { GenericStringStorage } from "../../fhevm/GenericStringStorage";
import { FhevmInstance } from "../../fhevm/fhevmTypes";
import { useFHECounterContractInfo } from "./useFHECounterContract";
import { useFHECounterCount } from "./useFHECounterCount";
import { useFHECounterDecrypt } from "./useFHECounterDecrypt";
import { useFHECounterMutations } from "./useFHECounterMutations";
import { useWagmiEthers } from "./useWagmiEthers";

export const useFHECounterWagmi = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  initialMockChains?: Readonly<Record<number, string>>;
}) => {
  const { instance, fhevmDecryptionSignatureStorage, initialMockChains } = parameters;

  // Wagmi + ethers interop
  const { chainId, accounts, isConnected, ethersReadonlyProvider, ethersSigner } = useWagmiEthers(initialMockChains);

  // Message bus shared by sub-hooks
  const [message, setMessage] = useState<string>("");

  // Contract info
  const { fheCounter } = useFHECounterContractInfo(chainId, setMessage);

  // Read count handle
  const {
    canGetCount,
    refreshCountHandle,
    isRefreshing,
    message: readMsg,
    countHandle,
  } = useFHECounterCount(fheCounter, ethersReadonlyProvider);

  // Prefer sub-hook message if present
  useMemo(() => {
    if (readMsg) setMessage(readMsg);
  }, [readMsg]);

  // Decrypt
  const {
    canDecrypt,
    decryptCountHandle,
    isDecrypted,
    isDecrypting,
    clearCount,
    message: decMsg,
  } = useFHECounterDecrypt({
    fheCounter,
    instance,
    ethersSigner,
    fhevmDecryptionSignatureStorage,
    chainId,
    countHandle,
  });

  useMemo(() => {
    if (decMsg) setMessage(decMsg);
  }, [decMsg]);

  // Mutations
  const {
    canUpdateCounter,
    updateCounter,
    isProcessing,
    message: mutMsg,
  } = useFHECounterMutations({
    fheCounter,
    instance,
    ethersSigner,
    refreshCountHandle,
  });

  useMemo(() => {
    if (mutMsg) setMessage(mutMsg);
  }, [mutMsg]);

  return {
    contractAddress: fheCounter.address,
    canDecrypt,
    canGetCount,
    canUpdateCounter,
    updateCounter,
    decryptCountHandle,
    refreshCountHandle,
    isDecrypted,
    message,
    clear: clearCount?.clear,
    handle: countHandle,
    isDecrypting,
    isRefreshing,
    isProcessing,
    // Wagmi-specific values
    chainId,
    accounts,
    isConnected,
    ethersSigner,
  };
};
