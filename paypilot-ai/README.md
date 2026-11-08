# PayPilot AI

**An AI-assisted Solana payment assistant.** Describe a payment in plain language, review the extracted recipient and amount, then approve a test-SOL transfer with Phantom on Solana Devnet.

## What it demonstrates

- Natural-language payment intent extraction with OpenAI (optional API key).
- A local demo parser fallback for requests containing a SOL amount and a full Solana address.
- Explicit human review before transaction signing.
- Phantom wallet connection and user-approved SOL transfer on Solana Devnet.
- Transaction confirmation and a Solana Explorer link.

## Tech stack

Next.js, React, TypeScript, OpenAI Responses API (`gpt-4o-mini` by default), `@solana/web3.js`, Phantom browser wallet, Solana Devnet.

## Run locally

1. Install Node.js 20 or later.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Optional: copy `.env.example` to `.env.local` and add an OpenAI API key to enable AI extraction:

   ```bash
   cp .env.example .env.local
   ```

   Without an API key, the app uses a basic local parser. The fallback requires a numeric amount such as `0.01 SOL` and a full Solana wallet address.

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000 and install/unlock the Phantom browser extension.

## Test safely on Devnet

1. Switch Phantom to **Devnet** (enable test networks in Phantom settings if needed).
2. Get free Devnet SOL from a Solana faucet.
3. Connect Phantom to PayPilot.
4. Enter a payment request with a full recipient address, for example:

   `Send 0.01 SOL to <FULL_SOLANA_WALLET_ADDRESS> for a demo`

5. Review the recipient and amount, then approve the transaction in Phantom.
6. Open the resulting signature in Solana Explorer using the Devnet cluster.

The app is configured for `https://api.devnet.solana.com`. It does not send mainnet funds.

## Safety notes

- The AI endpoint only extracts proposed payment details; it never signs or sends a transaction.
- The app validates the recipient as a Solana public key and limits demo transfers to 10 SOL.
- The user must approve the transaction in Phantom.
- Always verify the recipient and amount in the wallet confirmation before approving.
- Never paste a seed phrase or private key into this app.

## Hackathon submission notes

- Suggested category: **AI Track**, if OpenAI parsing is enabled and demonstrated.
- The app uses Solana Devnet for real transaction flow with test SOL.
- Do not claim a live deployment, video, or completed on-chain transaction unless you have actually created one.
