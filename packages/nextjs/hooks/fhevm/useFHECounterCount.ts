"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import type { Contract } from "~~/utils/scaffold-eth/contract";

type FHECounterInfo = Contract<"FHECounter"> & { chainId?: number };

export type ClearValueType = {
  handle: string;
  clear: string | bigint | boolean;
};

export const useFHECounterCount = (
  fheCounter: FHECounterInfo | undefined,
  ethersReadonlyProvider: ethers.AbstractProvider | undefined,
  chainId?: number,
) => {
  const [countHandle, setCountHandle] = useState<string | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const isRefreshingRef = useRef<boolean>(isRefreshing);
  const fheCounterRef = useRef<FHECounterInfo | undefined>(undefined);
  const ropRef = useRef<typeof ethersReadonlyProvider>(ethersReadonlyProvider);
  const addressRef = useRef<string | undefined>(fheCounter?.address);
  const chainIdRef = useRef<number | undefined>(chainId);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    if (!fheCounter) return;
    fheCounterRef.current = fheCounter;
    addressRef.current = fheCounter.address;
  }, [fheCounter]);

  useEffect(() => {
    chainIdRef.current = chainId;
  }, [chainId]);

  useEffect(() => {
    ropRef.current = ethersReadonlyProvider;
  }, [ethersReadonlyProvider]);

  const canGetCount = useMemo(() => {
    return Boolean(fheCounter?.address && ethersReadonlyProvider && !isRefreshing);
  }, [fheCounter?.address, ethersReadonlyProvider, isRefreshing]);

  const refreshCountHandle = useCallback(() => {
    if (isRefreshingRef.current) {
      return;
    }

    const currentProvider = ropRef.current;
    const currentAddress = addressRef.current;
    const currentChainId = chainIdRef.current;

    if (!fheCounterRef.current || !currentAddress || !currentChainId) {
      return;
    }

    if (!currentProvider) {
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    const thisChainId = currentChainId;
    const thisFheCounterAddress = currentAddress;

    const thisFheCounterContract = new ethers.Contract(
      thisFheCounterAddress,
      fheCounterRef.current.abi,
      currentProvider,
    );

    thisFheCounterContract
      .getCount()
      .then(value => {
        if (thisChainId === chainIdRef.current && thisFheCounterAddress === addressRef.current) {
          setCountHandle(value);
        }
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      })
      .catch(e => {
        setMessage("FHECounter.getCount() call failed! error=" + e);
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      });
  }, []);

  const hasProvider = Boolean(ethersReadonlyProvider);

  useEffect(() => {
    if (!fheCounter?.address || !hasProvider) return;
    const t = window.setTimeout(() => {
      refreshCountHandle();
    }, 500);
    return () => {
      window.clearTimeout(t);
    };
  }, [fheCounter?.address, hasProvider, chainId, refreshCountHandle]);

  return { canGetCount, refreshCountHandle, isRefreshing, message, countHandle, setMessage } as const;
};
