"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FHECounterInfoType } from "./useFHECounterContract";
import { ethers } from "ethers";

export type ClearValueType = {
  handle: string;
  clear: string | bigint | boolean;
};

export const useFHECounterCount = (
  fheCounter: FHECounterInfoType,
  ethersReadonlyProvider: ethers.AbstractProvider | undefined,
) => {
  const [countHandle, setCountHandle] = useState<string | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const isRefreshingRef = useRef<boolean>(isRefreshing);
  const fheCounterRef = useRef<FHECounterInfoType | undefined>(undefined);
  const ropRef = useRef<typeof ethersReadonlyProvider>(ethersReadonlyProvider);
  const addressRef = useRef<string | undefined>(fheCounter.address);
  const chainIdRef = useRef<number | undefined>(fheCounter.chainId);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    fheCounterRef.current = fheCounter;
    addressRef.current = fheCounter.address;
    chainIdRef.current = fheCounter.chainId;
  }, [fheCounter]);

  useEffect(() => {
    ropRef.current = ethersReadonlyProvider;
  }, [ethersReadonlyProvider]);

  const canGetCount = useMemo(() => {
    return fheCounter.address && ethersReadonlyProvider && !isRefreshing;
  }, [fheCounter.address, ethersReadonlyProvider, isRefreshing]);

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

  useEffect(() => {
    if (!fheCounter.address || !ethersReadonlyProvider) return;
    const t = window.setTimeout(() => {
      refreshCountHandle();
    }, 500);
    return () => {
      window.clearTimeout(t);
    };
  }, [fheCounter.address, !!ethersReadonlyProvider, fheCounter.chainId, refreshCountHandle]);

  return { canGetCount, refreshCountHandle, isRefreshing, message, countHandle, setMessage } as const;
};
