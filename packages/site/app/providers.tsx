"use client";

import type { ReactNode } from "react";

import { MetaMaskProvider } from "@/hooks/fhevm/metamask/useMetaMaskProvider";
import { InMemoryStorageProvider } from "@/hooks/fhevm/useInMemoryStorage";
import { MetaMaskEthersSignerProvider } from "@/hooks/fhevm/metamask/useMetaMaskEthersSigner";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <MetaMaskProvider>
      <MetaMaskEthersSignerProvider initialMockChains={{ 31337: "http://localhost:8545" }}>
        <InMemoryStorageProvider>{children}</InMemoryStorageProvider>
      </MetaMaskEthersSignerProvider>
    </MetaMaskProvider>
  );
}
