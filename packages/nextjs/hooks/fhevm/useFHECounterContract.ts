"use client";

import { useMemo, useRef } from "react";
import { FHECounterABI } from "../../abi/FHECounterABI";
import { FHECounterAddresses } from "../../abi/FHECounterAddresses";
import { ethers } from "ethers";

export type FHECounterInfoType = {
  abi: typeof FHECounterABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

export function getFHECounterByChainId(chainId: number | undefined): FHECounterInfoType {
  if (!chainId) {
    return { abi: FHECounterABI.abi };
  }

  const entry = FHECounterAddresses[chainId.toString() as keyof typeof FHECounterAddresses];

  if (!("address" in entry) || entry.address === ethers.ZeroAddress) {
    return { abi: FHECounterABI.abi, chainId };
  }

  return {
    address: entry?.address as `0x${string}` | undefined,
    chainId: entry?.chainId ?? chainId,
    chainName: entry?.chainName,
    abi: FHECounterABI.abi,
  };
}

export const useFHECounterContractInfo = (chainId: number | undefined, setMessage?: (msg: string) => void) => {
  const fheCounterRef = useRef<FHECounterInfoType | undefined>(undefined);

  const fheCounter = useMemo(() => {
    if (typeof chainId !== "number") {
      return fheCounterRef.current ?? { abi: FHECounterABI.abi };
    }

    const c = getFHECounterByChainId(chainId);
    fheCounterRef.current = c;

    if (!c.address && setMessage) {
      setMessage(`FHECounter deployment not found for chainId=${chainId}.`);
    }

    return c;
  }, [chainId, setMessage]);

  return { fheCounter } as const;
};
