// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {Voting} from "../src/Voting.sol";

contract VotingTest is Test {
    Voting public voting;
    address public alice;
    address public bob;
    address public charlie;

    function setUp() public {
        voting = new Voting();
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
    }

    function test_CreateProposal() public {
        vm.prank(alice);
        uint256 proposalId = voting.createProposal("Build a new park");
        
        assertEq(proposalId, 0);
        assertEq(voting.getProposalCount(), 1);
        
        (string memory description, uint256 voteCount, , address creator, bool executed) = voting.getProposal(0);
        
        assertEq(description, "Build a new park");
        assertEq(voteCount, 0);
        assertEq(creator, alice);
        assertFalse(executed);
    }

    function test_Vote() public {
        // Create a proposal
        vm.prank(alice);
        voting.createProposal("Build a new library");
        
        // Bob votes
        vm.prank(bob);
        voting.vote(0);
        
        // Check vote count
        (, uint256 voteCount, , , ) = voting.getProposal(0);
        assertEq(voteCount, 1);
        assertTrue(voting.hasVoted(0, bob));
    }

    function test_RevertWhen_VotingTwice() public {
        // Create a proposal
        vm.prank(alice);
        voting.createProposal("Increase funding");
        
        // Bob votes
        vm.prank(bob);
        voting.vote(0);
        
        // Bob tries to vote again
        vm.prank(bob);
        vm.expectRevert("Already voted on this proposal");
        voting.vote(0);
    }

    function test_MultipleVotes() public {
        // Create a proposal
        vm.prank(alice);
        voting.createProposal("Community event");
        
        // Multiple people vote
        vm.prank(alice);
        voting.vote(0);
        
        vm.prank(bob);
        voting.vote(0);
        
        vm.prank(charlie);
        voting.vote(0);
        
        // Check vote count
        (, uint256 voteCount, , , ) = voting.getProposal(0);
        assertEq(voteCount, 3);
    }

    function test_ExecuteProposal() public {
        // Create a proposal
        vm.prank(alice);
        voting.createProposal("New proposal");
        
        // Execute it
        vm.prank(alice);
        voting.executeProposal(0);
        
        // Check execution status
        (, , , , bool executed) = voting.getProposal(0);
        assertTrue(executed);
    }

    function test_RevertWhen_NonCreatorExecutes() public {
        // Alice creates a proposal
        vm.prank(alice);
        voting.createProposal("Alice's proposal");
        
        // Bob tries to execute it
        vm.prank(bob);
        vm.expectRevert("Only creator can execute");
        voting.executeProposal(0);
    }

    function test_RevertWhen_VotingOnExecutedProposal() public {
        // Create and execute a proposal
        vm.prank(alice);
        voting.createProposal("Executed proposal");
        
        vm.prank(alice);
        voting.executeProposal(0);
        
        // Try to vote on it
        vm.prank(bob);
        vm.expectRevert("Proposal already executed");
        voting.vote(0);
    }

    function test_RevertWhen_EmptyDescription() public {
        vm.prank(alice);
        vm.expectRevert("Description cannot be empty");
        voting.createProposal("");
    }

    function test_MultipleProposals() public {
        vm.prank(alice);
        voting.createProposal("Proposal 1");
        
        vm.prank(bob);
        voting.createProposal("Proposal 2");
        
        vm.prank(charlie);
        voting.createProposal("Proposal 3");
        
        assertEq(voting.getProposalCount(), 3);
        
        // Vote on different proposals
        vm.prank(alice);
        voting.vote(1);
        
        vm.prank(bob);
        voting.vote(2);
        
        vm.prank(charlie);
        voting.vote(0);
        
        (, uint256 voteCount1, , , ) = voting.getProposal(0);
        (, uint256 voteCount2, , , ) = voting.getProposal(1);
        (, uint256 voteCount3, , , ) = voting.getProposal(2);
        
        assertEq(voteCount1, 1);
        assertEq(voteCount2, 1);
        assertEq(voteCount3, 1);
    }
}

