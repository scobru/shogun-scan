import { MessageConstants } from '../types';

export const messages: MessageConstants = {
  signedIn: {
    header: `You're Signed In!`,
    body: `You just created an account using Hedgehog! Now, if you log out you will be able to sign back in with the same credentials.`,
  },
  signedOut: {
    header: `You're Not Signed In`,
    body: `You are currently unauthenticated / signed out.`,
    instructions: `Go ahead and create an account just like you would a centralized service.`,
  },
  invalid: `Incorrect username or password. Try again.`,
  empty: `Please enter a username and password.`,
  exists: `Account already exists, please try logging in.`,
  mismatched: `The passwords you entered don't match.`,
  metamaskMessage: `Access with shogun`,
  webauthnMessage: `Access with WebAuthn`,
};

export const rpcOptions = [
  {
    value: "mainnet",
    label: "Ethereum Mainnet",
    url: "https://eth-mainnet.g.alchemy.com/v2/yjhjIoJ3o_at8ALT7nCJtFtjdqFpiBdx",
  },
  {
    value: "sepolia",
    label: "Sepolia Testnet",
    url: "https://eth-sepolia.g.alchemy.com/v2/yjhjIoJ3o_at8ALT7nCJtFtjdqFpiBdx",
  },
  {
    value: "localhost",
    label: "Localhost",
    url: "http://127.0.0.1:8545",
  },
]; 