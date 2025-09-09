"use client";

import { useCallback, useMemo } from "react";
import { FhevmInstance } from "../../../fhevm/fhevmTypes";
import { ethers } from "ethers";

type EncryptResult = {
  handles: string[];
  inputProof: string;
};

// Minimal builder interface to avoid tight coupling with SDK types
type EncryptedInputBuilder = {
  add32: (value: number) => void;
  encrypt: () => Promise<EncryptResult>;
};

export const useFHEEncryption = (params: {
  instance: FhevmInstance | undefined;
  ethersSigner: ethers.Signer | undefined;
  contractAddress: `0x${string}` | undefined;
}) => {
  const { instance, ethersSigner, contractAddress } = params;

  const canEncrypt = useMemo(
    () => Boolean(instance && ethersSigner && contractAddress),
    [instance, ethersSigner, contractAddress],
  );

  const encryptWith = useCallback(
    async (buildFn: (builder: EncryptedInputBuilder) => void): Promise<EncryptResult | undefined> => {
      if (!instance || !ethersSigner || !contractAddress) return undefined;

      const userAddress = await ethersSigner.getAddress();
      const input = instance.createEncryptedInput(contractAddress, userAddress) as unknown as EncryptedInputBuilder;
      buildFn(input);
      const enc = await input.encrypt();
      return enc;
    },
    [instance, ethersSigner, contractAddress],
  );

  const encryptUint32 = useCallback(
    async (value: number): Promise<EncryptResult | undefined> => {
      return encryptWith(builder => builder.add32(value));
    },
    [encryptWith],
  );

  return { canEncrypt, encryptWith, encryptUint32 } as const;
};
