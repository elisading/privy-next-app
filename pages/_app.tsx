import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { PrivyProvider } from "@privy-io/react-auth";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <link
          rel="preload"
          href="/fonts/AdelleSans-Regular.woff"
          as="font"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/AdelleSans-Regular.woff2"
          as="font"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/AdelleSans-Semibold.woff"
          as="font"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/AdelleSans-Semibold.woff2"
          as="font"
          crossOrigin=""
        />

        <link rel="icon" href="/favicons/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicons/apple-touch-icon.png" />
        <link rel="manifest" href="/favicons/manifest.json" />

        <title>Privy Auth Starter</title>
        <meta name="description" content="Privy Auth Starter" />
      </Head>
      {/* <PrivyProvider
        appId={"cm1qxnbc108m4pz1ujl6vwvfs" || ""}
        config={{
          embeddedWallets: {
            createOnLogin: "all-users",
          },
        }}
      >
        <Component {...pageProps} />
      </PrivyProvider> */}
    <PrivyProvider 
      appId="cm1qxnbc108m4pz1ujl6vwvfs"
      config={{
      "appearance": {
        "accentColor": "#38CCCD",
        "theme": "#FFFFFF",
        "showWalletLoginFirst": false,
        "logo": "https://auth.privy.io/logos/privy-logo.png",
        "walletChainType": "solana-only"
      },
      "loginMethods": [
        "email",
        "wallet",
        "apple"
      ],
      "fundingMethodConfig": {
        "moonpay": {
          "useSandbox": true
        }
      },
      "embeddedWallets": {
        "createOnLogin": "off", // "all-users" | "users-without-wallets" | "off"
        "requireUserPasswordOnCreate": false
        /**
         * @deprecated. Instead, use the server-driven configuration found in the Privy console: https://dashboard.privy.io/apps/YOUR_APP_ID/embedded.
         * If true, Privy will not prompt or instantiate any UI for embedded wallet signatures and transactions.
         * If false, embedded wallet actions will raise a modal and require user confirmation to proceed.
         *
         * Defaults to false.
         */
      },
      "mfa": {
        "noPromptOnMfaRequired": false
      }
    }}
    >
    <Component {...pageProps} />
    </PrivyProvider>
    </>
  );
}

export default MyApp;