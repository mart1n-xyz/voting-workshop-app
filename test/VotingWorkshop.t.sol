// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console} from "forge-std/Test.sol";
import {VotingWorkshop} from "../src/VotingWorkshop.sol";

contract VotingWorkshopTest is Test {
    VotingWorkshop public workshop;
    address public alice;
    address public bob;
    address public charlie;

    function setUp() public {
        workshop = new VotingWorkshop();
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
    }

    function test_Register() public {
        vm.prank(alice);
        workshop.register();
        
        // Check that alice got ID 1
        assertEq(workshop.addressToId(alice), 1);
        assertEq(workshop.idToAddress(1), alice);
        assertEq(workshop.getTotalRegistered(), 1);
    }

    function test_RegisterMultipleUsers() public {
        // Alice registers
        vm.prank(alice);
        workshop.register();
        
        // Bob registers
        vm.prank(bob);
        workshop.register();
        
        // Charlie registers
        vm.prank(charlie);
        workshop.register();
        
        // Check IDs are assigned sequentially
        assertEq(workshop.addressToId(alice), 1);
        assertEq(workshop.addressToId(bob), 2);
        assertEq(workshop.addressToId(charlie), 3);
        
        // Check reverse mappings
        assertEq(workshop.idToAddress(1), alice);
        assertEq(workshop.idToAddress(2), bob);
        assertEq(workshop.idToAddress(3), charlie);
        
        assertEq(workshop.getTotalRegistered(), 3);
    }

    function test_RevertWhen_RegisteringTwice() public {
        vm.prank(alice);
        workshop.register();
        
        // Try to register again
        vm.prank(alice);
        vm.expectRevert("Already registered");
        workshop.register();
    }

    function test_IsRegistered() public {
        // Initially not registered
        assertFalse(workshop.isRegistered(alice));
        
        // Register alice
        vm.prank(alice);
        workshop.register();
        
        // Now registered
        assertTrue(workshop.isRegistered(alice));
        
        // Bob still not registered
        assertFalse(workshop.isRegistered(bob));
    }

    function test_TotalRegisteredIncrementsCorrectly() public {
        assertEq(workshop.getTotalRegistered(), 0);
        
        vm.prank(alice);
        workshop.register();
        assertEq(workshop.getTotalRegistered(), 1);
        
        vm.prank(bob);
        workshop.register();
        assertEq(workshop.getTotalRegistered(), 2);
        
        vm.prank(charlie);
        workshop.register();
        assertEq(workshop.getTotalRegistered(), 3);
    }

    function test_EventEmitted() public {
        vm.expectEmit(true, true, false, true);
        emit VotingWorkshop.UserRegistered(alice, 1);
        
        vm.prank(alice);
        workshop.register();
    }

    function test_BidirectionalMapping() public {
        vm.prank(alice);
        workshop.register();
        
        vm.prank(bob);
        workshop.register();
        
        // Test address -> ID mapping
        uint256 aliceId = workshop.addressToId(alice);
        uint256 bobId = workshop.addressToId(bob);
        
        assertEq(aliceId, 1);
        assertEq(bobId, 2);
        
        // Test ID -> address mapping (reverse lookup)
        assertEq(workshop.idToAddress(aliceId), alice);
        assertEq(workshop.idToAddress(bobId), bob);
    }

    function test_UnregisteredAddressReturnsZero() public view {
        // Unregistered address should return 0
        assertEq(workshop.addressToId(alice), 0);
        assertEq(workshop.idToAddress(999), address(0));
    }

    // ====== ELECTION MANAGEMENT TESTS ======

    function test_OpenNewElection() public {
        uint256 electionId = workshop.openElection(0, false);
        
        assertEq(electionId, 1);
        assertEq(workshop.getTotalElections(), 1);
        assertTrue(workshop.isElectionOpen(1));
        
        // Check election details
        VotingWorkshop.Election memory election = workshop.getElection(1);
        assertEq(election.id, 1);
        assertEq(uint(election.status), uint(VotingWorkshop.ElectionStatus.Open));
        assertFalse(election.isPublic);
        assertGt(election.openedAt, 0);
        assertEq(election.closedAt, 0);
    }

    function test_OpenPublicElection() public {
        uint256 electionId = workshop.openElection(0, true);
        
        VotingWorkshop.Election memory election = workshop.getElection(electionId);
        assertTrue(election.isPublic);
    }

    function test_OpenMultipleElections() public {
        uint256 election1 = workshop.openElection(0, false);
        uint256 election2 = workshop.openElection(0, true);
        uint256 election3 = workshop.openElection(0, false);
        
        assertEq(election1, 1);
        assertEq(election2, 2);
        assertEq(election3, 3);
        assertEq(workshop.getTotalElections(), 3);
    }

    function test_CloseElection() public {
        uint256 electionId = workshop.openElection(0, false);
        
        workshop.closeElection(electionId);
        
        assertFalse(workshop.isElectionOpen(electionId));
        
        VotingWorkshop.Election memory election = workshop.getElection(electionId);
        assertEq(uint(election.status), uint(VotingWorkshop.ElectionStatus.Closed));
        assertGt(election.closedAt, 0);
    }

    function test_ReopenElection() public {
        uint256 electionId = workshop.openElection(0, false);
        
        workshop.closeElection(electionId);
        assertFalse(workshop.isElectionOpen(electionId));
        
        // Reopen the same election
        uint256 reopenedId = workshop.openElection(electionId, true); // true is ignored
        
        assertEq(reopenedId, electionId);
        assertTrue(workshop.isElectionOpen(electionId));
        
        VotingWorkshop.Election memory election = workshop.getElection(electionId);
        assertFalse(election.isPublic); // Should remain false (original value)
        assertEq(election.closedAt, 0); // Reset when reopened
    }

    function test_ReopenElectionMultipleTimes() public {
        uint256 electionId = workshop.openElection(0, true);
        
        // Close and reopen multiple times
        workshop.closeElection(electionId);
        workshop.openElection(electionId, false); // false is ignored
        
        workshop.closeElection(electionId);
        workshop.openElection(electionId, false); // false is ignored
        
        assertTrue(workshop.isElectionOpen(electionId));
        
        VotingWorkshop.Election memory election = workshop.getElection(electionId);
        assertTrue(election.isPublic); // Remains true from original
    }

    function test_RevertWhen_NonOwnerOpensElection() public {
        vm.prank(alice);
        vm.expectRevert();
        workshop.openElection(0, false);
    }

    function test_RevertWhen_NonOwnerClosesElection() public {
        uint256 electionId = workshop.openElection(0, false);
        
        vm.prank(alice);
        vm.expectRevert();
        workshop.closeElection(electionId);
    }

    function test_RevertWhen_ClosingNonExistentElection() public {
        vm.expectRevert("Election does not exist");
        workshop.closeElection(999);
    }

    function test_RevertWhen_ClosingAlreadyClosedElection() public {
        uint256 electionId = workshop.openElection(0, false);
        workshop.closeElection(electionId);
        
        vm.expectRevert("Election is not open");
        workshop.closeElection(electionId);
    }

    function test_RevertWhen_ReopeningNonExistentElection() public {
        vm.expectRevert("Election does not exist");
        workshop.openElection(999, false);
    }

    function test_RevertWhen_ReopeningAlreadyOpenElection() public {
        uint256 electionId = workshop.openElection(0, false);
        
        vm.expectRevert("Election is already open");
        workshop.openElection(electionId, false);
    }

    function test_ElectionOpenedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit VotingWorkshop.ElectionOpened(1, false, block.timestamp);
        
        workshop.openElection(0, false);
    }

    function test_ElectionClosedEvent() public {
        uint256 electionId = workshop.openElection(0, false);
        
        vm.expectEmit(true, false, false, true);
        emit VotingWorkshop.ElectionClosed(electionId, block.timestamp);
        
        workshop.closeElection(electionId);
    }

    // ====== PRIVATE VOTING TESTS ======

    function test_CastPrivateVote() public {
        // Setup: Register user and open private election
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false); // Private election
        
        // Cast vote
        bytes memory encryptedSig = hex"1234567890abcdef";
        vm.prank(alice);
        workshop.castPrivateVote(electionId, encryptedSig);
        
        // Check vote was recorded
        assertTrue(workshop.hasVoted(electionId, 1));
        assertTrue(workshop.hasUserVoted(electionId, alice));
        assertEq(workshop.getVoteCount(electionId), 1);
    }

    function test_CastMultiplePrivateVotes() public {
        // Register users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        vm.prank(charlie);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        // All users vote
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"aa");
        
        vm.prank(bob);
        workshop.castPrivateVote(electionId, hex"bb");
        
        vm.prank(charlie);
        workshop.castPrivateVote(electionId, hex"cc");
        
        assertEq(workshop.getVoteCount(electionId), 3);
    }

    function test_RevertWhen_VotingInNonExistentElection() public {
        vm.prank(alice);
        workshop.register();
        
        vm.prank(alice);
        vm.expectRevert("Election does not exist");
        workshop.castPrivateVote(999, hex"1234");
    }

    function test_RevertWhen_VotingInClosedElection() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        workshop.closeElection(electionId);
        
        vm.prank(alice);
        vm.expectRevert("Election is not open");
        workshop.castPrivateVote(electionId, hex"1234");
    }

    function test_RevertWhen_VotingInPublicElection() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true); // Public election
        
        vm.prank(alice);
        vm.expectRevert("Election is not private");
        workshop.castPrivateVote(electionId, hex"1234");
    }

    function test_RevertWhen_UnregisteredUserVotes() public {
        uint256 electionId = workshop.openElection(0, false);
        
        vm.prank(alice); // Alice is not registered
        vm.expectRevert("Voter is not registered");
        workshop.castPrivateVote(electionId, hex"1234");
    }

    function test_RevertWhen_VotingTwice() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        // First vote succeeds
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"1234");
        
        // Second vote fails
        vm.prank(alice);
        vm.expectRevert("Already voted in this election");
        workshop.castPrivateVote(electionId, hex"5678");
    }

    function test_RevertWhen_EmptySignature() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        vm.prank(alice);
        vm.expectRevert("Encrypted signature cannot be empty");
        workshop.castPrivateVote(electionId, hex"");
    }

    function test_PrivateVoteCastEvent() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        vm.expectEmit(true, true, false, true);
        emit VotingWorkshop.PrivateVoteCast(electionId, 1, block.timestamp);
        
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"1234");
    }

    // ====== READ FUNCTIONS TESTS ======

    function test_GetPrivateVote() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        bytes memory encryptedSig = hex"1234567890abcdef";
        vm.prank(alice);
        workshop.castPrivateVote(electionId, encryptedSig);
        
        bytes memory retrieved = workshop.getPrivateVote(electionId, 1);
        assertEq(retrieved, encryptedSig);
    }

    function test_GetVotersInElection() public {
        // Register users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        vm.prank(charlie);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        // Cast votes
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"aa");
        vm.prank(bob);
        workshop.castPrivateVote(electionId, hex"bb");
        vm.prank(charlie);
        workshop.castPrivateVote(electionId, hex"cc");
        
        uint256[] memory voters = workshop.getVotersInElection(electionId);
        
        assertEq(voters.length, 3);
        assertEq(voters[0], 1); // Alice
        assertEq(voters[1], 2); // Bob
        assertEq(voters[2], 3); // Charlie
    }

    function test_GetAllPrivateVotes() public {
        // Register users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        // Cast votes
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"aabbcc");
        vm.prank(bob);
        workshop.castPrivateVote(electionId, hex"ddeeff");
        
        (uint256[] memory userIds, bytes[] memory signatures) = workshop.getAllPrivateVotes(electionId);
        
        assertEq(userIds.length, 2);
        assertEq(signatures.length, 2);
        
        assertEq(userIds[0], 1);
        assertEq(userIds[1], 2);
        
        assertEq(signatures[0], hex"aabbcc");
        assertEq(signatures[1], hex"ddeeff");
    }

    function test_GetAllPrivateVotes_EmptyElection() public {
        uint256 electionId = workshop.openElection(0, false);
        
        (uint256[] memory userIds, bytes[] memory signatures) = workshop.getAllPrivateVotes(electionId);
        
        assertEq(userIds.length, 0);
        assertEq(signatures.length, 0);
    }

    function test_GetPrivateVotesBatch() public {
        // Register 5 users
        address[] memory users = new address[](5);
        for (uint i = 0; i < 5; i++) {
            users[i] = makeAddr(string(abi.encodePacked("user", i)));
            vm.prank(users[i]);
            workshop.register();
        }
        
        uint256 electionId = workshop.openElection(0, false);
        
        // Cast 5 votes
        for (uint i = 0; i < 5; i++) {
            vm.prank(users[i]);
            workshop.castPrivateVote(electionId, abi.encodePacked(uint8(i)));
        }
        
        // Get first 3 votes
        (uint256[] memory userIds, bytes[] memory signatures, uint256 total) = 
            workshop.getPrivateVotesBatch(electionId, 0, 3);
        
        assertEq(total, 5);
        assertEq(userIds.length, 3);
        assertEq(signatures.length, 3);
        
        // Get next 2 votes
        (userIds, signatures, total) = workshop.getPrivateVotesBatch(electionId, 3, 3);
        
        assertEq(total, 5);
        assertEq(userIds.length, 2); // Only 2 remaining
        assertEq(signatures.length, 2);
    }

    function test_GetPrivateVotesBatch_GetAllRemaining() public {
        // Register 3 users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        vm.prank(charlie);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"aa");
        vm.prank(bob);
        workshop.castPrivateVote(electionId, hex"bb");
        vm.prank(charlie);
        workshop.castPrivateVote(electionId, hex"cc");
        
        // Get all with limit = 0
        (uint256[] memory userIds, bytes[] memory signatures, uint256 total) = 
            workshop.getPrivateVotesBatch(electionId, 0, 0);
        
        assertEq(total, 3);
        assertEq(userIds.length, 3);
        assertEq(signatures.length, 3);
    }

    function test_HasUserVoted() public {
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false);
        
        assertFalse(workshop.hasUserVoted(electionId, alice));
        assertFalse(workshop.hasUserVoted(electionId, bob));
        
        vm.prank(alice);
        workshop.castPrivateVote(electionId, hex"1234");
        
        assertTrue(workshop.hasUserVoted(electionId, alice));
        assertFalse(workshop.hasUserVoted(electionId, bob));
    }

    function test_HasUserVoted_UnregisteredUser() public {
        uint256 electionId = workshop.openElection(0, false);
        
        assertFalse(workshop.hasUserVoted(electionId, alice)); // Unregistered returns false
    }

    // ====== PUBLIC VOTING TESTS ======

    function test_CastPublicVote() public {
        // Setup: Register user and open public election
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true); // Public election
        
        // Cast vote for choice 1
        vm.prank(alice);
        workshop.castPublicVote(electionId, 1);
        
        // Check vote was recorded
        assertTrue(workshop.hasVoted(electionId, 1));
        assertTrue(workshop.hasUserVoted(electionId, alice));
        assertEq(workshop.getVoteCount(electionId), 1);
        assertEq(workshop.getPublicVote(electionId, 1), 1);
        assertEq(workshop.getChoiceVoteCount(electionId, 1), 1);
    }

    function test_CastMultiplePublicVotes() public {
        // Register users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        vm.prank(charlie);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true);
        
        // Users vote for different choices
        vm.prank(alice);
        workshop.castPublicVote(electionId, 1);
        
        vm.prank(bob);
        workshop.castPublicVote(electionId, 2);
        
        vm.prank(charlie);
        workshop.castPublicVote(electionId, 1);
        
        // Check total votes
        assertEq(workshop.getVoteCount(electionId), 3);
        
        // Check vote counts per choice
        assertEq(workshop.getChoiceVoteCount(electionId, 1), 2); // Alice and Charlie
        assertEq(workshop.getChoiceVoteCount(electionId, 2), 1); // Bob
        assertEq(workshop.getChoiceVoteCount(electionId, 3), 0); // No votes
    }

    function test_PublicVoteTallyUpdatesInRealTime() public {
        // Register users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        vm.prank(charlie);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true);
        
        // Initial counts should be 0
        assertEq(workshop.getChoiceVoteCount(electionId, 1), 0);
        
        // First vote
        vm.prank(alice);
        workshop.castPublicVote(electionId, 1);
        assertEq(workshop.getChoiceVoteCount(electionId, 1), 1);
        
        // Second vote
        vm.prank(bob);
        workshop.castPublicVote(electionId, 1);
        assertEq(workshop.getChoiceVoteCount(electionId, 1), 2);
        
        // Third vote for different choice
        vm.prank(charlie);
        workshop.castPublicVote(electionId, 2);
        assertEq(workshop.getChoiceVoteCount(electionId, 1), 2);
        assertEq(workshop.getChoiceVoteCount(electionId, 2), 1);
    }

    function test_GetElectionResults() public {
        // Register users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        vm.prank(charlie);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true);
        
        // Cast votes
        vm.prank(alice);
        workshop.castPublicVote(electionId, 1);
        vm.prank(bob);
        workshop.castPublicVote(electionId, 2);
        vm.prank(charlie);
        workshop.castPublicVote(electionId, 1);
        
        // Get results for choices 1 through 4
        uint256[] memory results = workshop.getElectionResults(electionId, 4);
        
        assertEq(results[0], 2); // Choice 1: 2 votes
        assertEq(results[1], 1); // Choice 2: 1 vote
        assertEq(results[2], 0); // Choice 3: 0 votes
        assertEq(results[3], 0); // Choice 4: 0 votes
    }

    function test_GetAllPublicVotes() public {
        // Register users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true);
        
        // Cast votes
        vm.prank(alice);
        workshop.castPublicVote(electionId, 3);
        vm.prank(bob);
        workshop.castPublicVote(electionId, 1);
        
        (uint256[] memory userIds, uint256[] memory choices) = workshop.getAllPublicVotes(electionId);
        
        assertEq(userIds.length, 2);
        assertEq(choices.length, 2);
        
        assertEq(userIds[0], 1); // Alice
        assertEq(userIds[1], 2); // Bob
        
        assertEq(choices[0], 3); // Alice voted for 3
        assertEq(choices[1], 1); // Bob voted for 1
    }

    function test_RevertWhen_PublicVotingInNonExistentElection() public {
        vm.prank(alice);
        workshop.register();
        
        vm.prank(alice);
        vm.expectRevert("Election does not exist");
        workshop.castPublicVote(999, 1);
    }

    function test_RevertWhen_PublicVotingInClosedElection() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true);
        workshop.closeElection(electionId);
        
        vm.prank(alice);
        vm.expectRevert("Election is not open");
        workshop.castPublicVote(electionId, 1);
    }

    function test_RevertWhen_PublicVotingInPrivateElection() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, false); // Private election
        
        vm.prank(alice);
        vm.expectRevert("Election is not public");
        workshop.castPublicVote(electionId, 1);
    }

    function test_RevertWhen_UnregisteredUserVotesPublic() public {
        uint256 electionId = workshop.openElection(0, true);
        
        vm.prank(alice); // Alice is not registered
        vm.expectRevert("Voter is not registered");
        workshop.castPublicVote(electionId, 1);
    }

    function test_RevertWhen_PublicVotingTwice() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true);
        
        // First vote succeeds
        vm.prank(alice);
        workshop.castPublicVote(electionId, 1);
        
        // Second vote fails
        vm.prank(alice);
        vm.expectRevert("Already voted in this election");
        workshop.castPublicVote(electionId, 2);
    }

    function test_RevertWhen_PublicVoteChoiceIsZero() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true);
        
        vm.prank(alice);
        vm.expectRevert("Choice must be greater than 0");
        workshop.castPublicVote(electionId, 0);
    }

    function test_PublicVoteCastEvent() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true);
        
        vm.expectEmit(true, true, false, true);
        emit VotingWorkshop.PublicVoteCast(electionId, 1, 2, block.timestamp);
        
        vm.prank(alice);
        workshop.castPublicVote(electionId, 2);
    }

    function test_PublicVoteWithHighChoiceNumbers() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true);
        
        // Vote for choice 100
        vm.prank(alice);
        workshop.castPublicVote(electionId, 100);
        
        assertEq(workshop.getPublicVote(electionId, 1), 100);
        assertEq(workshop.getChoiceVoteCount(electionId, 100), 1);
    }

    function test_RevertWhen_GetPublicVote_NotVoted() public {
        vm.prank(alice);
        workshop.register();
        
        uint256 electionId = workshop.openElection(0, true);
        
        // User hasn't voted, should revert
        vm.expectRevert("User has not voted in this election");
        workshop.getPublicVote(electionId, 1);
    }

    function test_MixedElections_PrivateAndPublic() public {
        // Register users
        vm.prank(alice);
        workshop.register();
        vm.prank(bob);
        workshop.register();
        
        // Open private and public elections
        uint256 privateElection = workshop.openElection(0, false);
        uint256 publicElection = workshop.openElection(0, true);
        
        // Alice votes in private election
        vm.prank(alice);
        workshop.castPrivateVote(privateElection, hex"abc123");
        
        // Bob votes in public election
        vm.prank(bob);
        workshop.castPublicVote(publicElection, 3);
        
        // Verify both elections have separate vote counts
        assertEq(workshop.getVoteCount(privateElection), 1);
        assertEq(workshop.getVoteCount(publicElection), 1);
        
        // Verify votes are in correct elections
        assertTrue(workshop.hasUserVoted(privateElection, alice));
        assertFalse(workshop.hasUserVoted(publicElection, alice));
        
        assertFalse(workshop.hasUserVoted(privateElection, bob));
        assertTrue(workshop.hasUserVoted(publicElection, bob));
    }
}

