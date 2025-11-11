/**
 * Hook for private voting functionality
 * Handles signing, verification, encryption, and submission of private votes
 */

import { useState } from 'react';
import { usePrivy, useSendTransaction } from '@privy-io/react-auth';
import { encodeFunctionData } from 'viem';
import { encryptSignature, verifySignature } from '@/utils/encryption';
import { VoteConfig, VOTING_CONTRACT_ADDRESS } from '@/config/votesConfig';

// ABI for castPrivateVote function
const CAST_PRIVATE_VOTE_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "electionId", type: "uint256" },
      { internalType: "bytes", name: "encryptedSignature", type: "bytes" }
    ],
    name: "castPrivateVote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * Generate the vote message for a specific option
 * This message will be signed by the user's wallet
 */
export function generateVoteMessage(optionText: string): string {
  return `I vote for ${optionText}`;
}

export interface UsePrivateVotingProps {
  voteConfig: VoteConfig;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export interface UsePrivateVotingReturn {
  submitPrivateVote: (optionId: number) => Promise<void>;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Hook for submitting private votes
 * Handles the complete flow: sign -> verify -> encrypt -> submit
 */
export function usePrivateVoting({
  voteConfig,
  onSuccess,
  onError,
}: UsePrivateVotingProps): UsePrivateVotingReturn {
  const { user, signMessage } = usePrivy();
  const { sendTransaction } = useSendTransaction();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPrivateVote = async (optionId: number) => {
    setError(null);
    setIsSubmitting(true);

    try {
      // Step 0: Validate user is authenticated
      const walletAddress = user?.wallet?.address;
      if (!walletAddress) {
        throw new Error('No wallet address found');
      }

      // Step 1: Find the selected option
      const selectedOption = voteConfig.options.find(opt => opt.id === optionId);
      if (!selectedOption) {
        throw new Error('Invalid option selected');
      }

      // Step 2: Generate the vote message
      const message = generateVoteMessage(selectedOption.text);
      
      // Step 3: Sign the message with user's wallet
      let signature: string;
      try {
        const signResult = await signMessage(message);
        signature = signResult;
      } catch (signError: any) {
        // User rejected signing
        if (signError.message?.includes('rejected') || signError.message?.includes('denied')) {
          throw new Error('Signature rejected by user');
        }
        throw new Error(`Failed to sign message: ${signError.message || 'Unknown error'}`);
      }

      // Step 4: Verify the signature is valid (client-side check)
      const isValidSignature = verifySignature(message, signature, walletAddress);
      if (!isValidSignature) {
        throw new Error('Invalid signature format');
      }

      // Step 5: Encrypt the signature with public key
      let encryptedSig: string;
      try {
        encryptedSig = encryptSignature(signature);
      } catch (encryptError: any) {
        throw new Error(`Encryption failed: ${encryptError.message}`);
      }

      // Step 6: Convert encrypted signature to bytes for contract
      // The encryptedSig is base64, we need to convert it to hex for the contract
      const encryptedBytes = Buffer.from(encryptedSig, 'base64');
      const encryptedHex = `0x${encryptedBytes.toString('hex')}` as `0x${string}`;

      // Step 7: Encode the contract call
      const data = encodeFunctionData({
        abi: CAST_PRIVATE_VOTE_ABI,
        functionName: "castPrivateVote",
        args: [BigInt(voteConfig.electionId), encryptedHex],
      });

      // Step 8: Submit the transaction
      await sendTransaction({
        to: VOTING_CONTRACT_ADDRESS,
        data: data,
        value: BigInt(0),
      });

      // Success!
      onSuccess?.();
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to submit vote';
      setError(errorMessage);
      onError?.(errorMessage);
      throw err; // Re-throw so caller can handle if needed
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submitPrivateVote,
    isSubmitting,
    error,
  };
}


