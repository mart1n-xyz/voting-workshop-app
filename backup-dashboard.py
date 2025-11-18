"""
Voting Workshop Backup Dashboard
A backup Streamlit application for the voting workshop.
"""

import streamlit as st
import json
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct
import pandas as pd
import plotly.graph_objects as go
import time
from datetime import datetime
import base64
import nacl.public

# Page configuration
st.set_page_config(
    page_title="Voting Workshop Backup Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS for modern styling
st.markdown("""
<style>
    /* Main container styling */
    .block-container {
        padding-top: 2rem;
        padding-bottom: 2rem;
    }
    
    /* Header styling */
    h1 {
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 1.5rem;
    }
    
    h2 {
        font-weight: 600;
        color: #334155;
        margin-top: 2rem;
        margin-bottom: 1rem;
    }
    
    h3 {
        font-weight: 600;
        color: #475569;
    }
    
    /* Metric styling */
    [data-testid="stMetricValue"] {
        font-size: 1.8rem;
        font-weight: 700;
    }
    
    /* Button styling */
    .stButton > button {
        border-radius: 0.5rem;
        font-weight: 500;
        transition: all 0.2s;
    }
    
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    
    /* Expander styling */
    .streamlit-expanderHeader {
        background-color: #f8fafc;
        border-radius: 0.5rem;
        font-weight: 600;
    }
    
    /* Success/Info/Warning box styling */
    .stAlert {
        border-radius: 0.5rem;
    }
    
    /* Divider */
    hr {
        margin: 2rem 0;
        border-color: #e2e8f0;
    }
</style>
""", unsafe_allow_html=True)

# Contract configuration
CONTRACT_ADDRESS = "0xBA2741D011e34F154FF6E886e051c4278aC8B9AF"

# Default RPC endpoint
DEFAULT_RPC_URL = "https://public.sepolia.rpc.status.network"

# Default decryption key (Base64 encoded)
DEFAULT_DECRYPTION_KEY = "UgsmFEqNQrYE32riH1Ph0mBV7g2IVQ1FIXPEbTyb0zY="

# Vote configuration (matches votesConfig.ts)
VOTE_CONFIGS = {
    "vote0": {
        "voteKey": "vote0",
        "electionId": 1,
        "type": "public",
        "title": "Training Ground",
        "options": [
            {"id": 1, "text": "Feeling Messi-level productive today"},
            {"id": 2, "text": "Surviving on empanadas and wine"},
            {"id": 3, "text": "Could use a siesta."},
            {"id": 4, "text": "Like the Buenos Aires weather - a bit unpredictable"},
        ],
    },
    "vote1a": {
        "voteKey": "vote1a",
        "electionId": 2,
        "type": "public",
        "title": "Vote 1a: Coordination",
        "options": [
            {"id": 1, "text": "District A"},
            {"id": 2, "text": "District B"},
            {"id": 3, "text": "District C"},
            {"id": 4, "text": "District D"},
        ],
    },
    "vote1b": {
        "voteKey": "vote1b",
        "electionId": 3,
        "type": "private",
        "title": "Vote 1b: Private Coordination",
        "options": [
            {"id": 1, "text": "District A"},
            {"id": 2, "text": "District B"},
            {"id": 3, "text": "District C"},
            {"id": 4, "text": "District D"},
        ],
    },
    "vote2a": {
        "voteKey": "vote2a",
        "electionId": 4,
        "type": "public",
        "title": "Vote 2a: Strategic Initiative - Round 1 (Public)",
        "options": [
            {"id": 1, "text": "A – Citywide Campaign (Marketing)"},
            {"id": 2, "text": "B – Process Upgrade (Operations)"},
            {"id": 3, "text": "C – Community Program (Community)"},
            {"id": 4, "text": "D – Shared Hub (Everyone)"},
        ],
    },
    "vote2b": {
        "voteKey": "vote2b",
        "electionId": 5,
        "type": "public",
        "title": "Vote 2b: Strategic Initiative - Round 2 (Public)",
        "options": [
            {"id": 1, "text": "A – Citywide Campaign (Marketing)"},
            {"id": 2, "text": "B – Process Upgrade (Operations)"},
            {"id": 3, "text": "C – Community Program (Community)"},
            {"id": 4, "text": "D – Shared Hub (Everyone)"},
        ],
    },
    "vote2c": {
        "voteKey": "vote2c",
        "electionId": 6,
        "type": "private",
        "title": "Vote 2c: Strategic Initiative - Round 3 (Private)",
        "options": [
            {"id": 1, "text": "A – Citywide Campaign (Marketing)"},
            {"id": 2, "text": "B – Process Upgrade (Operations)"},
            {"id": 3, "text": "C – Community Program (Community)"},
            {"id": 4, "text": "D – Shared Hub (Everyone)"},
        ],
    },
    "vote2d": {
        "voteKey": "vote2d",
        "electionId": 7,
        "type": "private",
        "title": "Vote 2d: Strategic Initiative - Round 4 (Final, Private)",
        "options": [
            {"id": 1, "text": "A – Citywide Campaign (Marketing)"},
            {"id": 2, "text": "B – Process Upgrade (Operations)"},
            {"id": 3, "text": "C – Community Program (Community)"},
            {"id": 4, "text": "D – Shared Hub (Everyone, bonus if ≥50%)"},
        ],
    },
    "vote3": {
        "voteKey": "vote3",
        "electionId": 8,
        "type": "public",
        "title": "Vote 3: Merit vs Luck",
        "options": [
            {"id": 1, "text": "Award to current 3rd place participant"},
            {"id": 2, "text": "Random draw among all participants"},
        ],
    },
}

# Generate vote options for signature verification (for private votes)
# These are the messages users sign: "I vote for [option text]"
def get_vote_signature_options(vote_config):
    """Generate signature verification options from vote config"""
    return [f"I vote for {opt['text']}" for opt in vote_config['options']]

# Decryption functions
def decrypt_signature(encrypted_base64, private_key_base64):
    """Decrypt an encrypted signature using the private key"""
    try:
        # Decode private key
        private_key_bytes = base64.b64decode(private_key_base64)
        
        if len(private_key_bytes) != 32:
            raise ValueError(f"Invalid private key length: {len(private_key_bytes)} bytes (expected 32)")
        
        # Decode encrypted message
        full_message = base64.b64decode(encrypted_base64)
        
        # Extract components
        ephemeral_public_key = full_message[0:32]
        nonce = full_message[32:56]
        encrypted = full_message[56:]
        
        # Create NaCl box for decryption
        private_key = nacl.public.PrivateKey(private_key_bytes)
        public_key = nacl.public.PublicKey(ephemeral_public_key)
        box = nacl.public.Box(private_key, public_key)
        
        # Decrypt
        decrypted = box.decrypt(encrypted, nonce)
        
        # Convert to string (should be hex signature)
        signature = decrypted.decode('utf-8')
        
        return signature
    except Exception as e:
        raise Exception(f"Decryption error: {str(e)}")

def verify_vote_signature(signature, voter_address, options):
    """Verify which option a signature corresponds to"""
    try:
        # Try each option
        for i, message in enumerate(options):
            try:
                # Encode the message
                encoded_message = encode_defunct(text=message)
                
                # Recover the address from the signature
                recovered_address = Account.recover_message(encoded_message, signature=signature)
                
                # Check if it matches the voter address
                if recovered_address.lower() == voter_address.lower():
                    return {
                        'optionIndex': i,
                        'optionText': message,
                        'choice': i + 1  # 1-indexed for display
                    }
            except Exception:
                # This option doesn't match, continue
                continue
        
        # No match found
        return None
    except Exception as e:
        raise Exception(f"Signature verification error: {str(e)}")

def decrypt_and_verify_vote(encrypted_bytes, voter_address, private_key_base64, options):
    """Complete flow: Decrypt and verify a vote from contract bytes"""
    try:
        # encrypted_bytes is already the encrypted signature from contract (bytes)
        # Convert to base64 if needed
        if isinstance(encrypted_bytes, bytes):
            encrypted_signature = base64.b64encode(encrypted_bytes).decode('utf-8')
        else:
            encrypted_signature = encrypted_bytes
        
        # Step 1: Decrypt signature
        decrypted_signature = decrypt_signature(encrypted_signature, private_key_base64)
        
        # Step 2: Verify which option was voted for
        vote = verify_vote_signature(decrypted_signature, voter_address, options)
        
        return {
            'encryptedSignature': encrypted_signature,
            'decryptedSignature': decrypted_signature,
            'vote': vote
        }
    except Exception as e:
        raise Exception(f"Failed to decrypt and verify vote: {str(e)}")

# Contract ABI (full ABI from deployed contract)
CONTRACT_ABI = json.loads('''[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"electionId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"ElectionClosed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"electionId","type":"uint256"},{"indexed":false,"internalType":"bool","name":"isPublic","type":"bool"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"ElectionOpened","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"electionId","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"userId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"PrivateVoteCast","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint256","name":"electionId","type":"uint256"},{"indexed":true,"internalType":"uint256","name":"userId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"choice","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"PublicVoteCast","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"uint256","name":"userId","type":"uint256"}],"name":"UserRegistered","type":"event"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"addressToId","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"},{"internalType":"bytes","name":"encryptedSignature","type":"bytes"}],"name":"castPrivateVote","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"},{"internalType":"uint256","name":"choice","type":"uint256"}],"name":"castPublicVote","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"closeElection","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"electionIds","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"elections","outputs":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum VotingWorkshop.ElectionStatus","name":"status","type":"uint8"},{"internalType":"bool","name":"isPublic","type":"bool"},{"internalType":"uint256","name":"openedAt","type":"uint256"},{"internalType":"uint256","name":"closedAt","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"getAllPrivateVotes","outputs":[{"internalType":"uint256[]","name":"userIds","type":"uint256[]"},{"internalType":"bytes[]","name":"signatures","type":"bytes[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"getAllPublicVotes","outputs":[{"internalType":"uint256[]","name":"userIds","type":"uint256[]"},{"internalType":"uint256[]","name":"choices","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"},{"internalType":"uint256","name":"choice","type":"uint256"}],"name":"getChoiceVoteCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"getElection","outputs":[{"components":[{"internalType":"uint256","name":"id","type":"uint256"},{"internalType":"enum VotingWorkshop.ElectionStatus","name":"status","type":"uint8"},{"internalType":"bool","name":"isPublic","type":"bool"},{"internalType":"uint256","name":"openedAt","type":"uint256"},{"internalType":"uint256","name":"closedAt","type":"uint256"}],"internalType":"struct VotingWorkshop.Election","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"},{"internalType":"uint256","name":"numChoices","type":"uint256"}],"name":"getElectionResults","outputs":[{"internalType":"uint256[]","name":"counts","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"},{"internalType":"uint256","name":"userId","type":"uint256"}],"name":"getPrivateVote","outputs":[{"internalType":"bytes","name":"","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"},{"internalType":"uint256","name":"startIndex","type":"uint256"},{"internalType":"uint256","name":"limit","type":"uint256"}],"name":"getPrivateVotesBatch","outputs":[{"internalType":"uint256[]","name":"userIds","type":"uint256[]"},{"internalType":"bytes[]","name":"signatures","type":"bytes[]"},{"internalType":"uint256","name":"total","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"},{"internalType":"uint256","name":"userId","type":"uint256"}],"name":"getPublicVote","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTotalElections","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getTotalRegistered","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"getVoteCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"getVotersInElection","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"},{"internalType":"address","name":"userAddress","type":"address"}],"name":"hasUserVoted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"hasVoted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"idToAddress","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"}],"name":"isElectionOpen","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"isRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"electionId","type":"uint256"},{"internalType":"bool","name":"isPublic","type":"bool"}],"name":"openElection","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"publicVotes","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"register","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"voteCountPerChoice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]''')

# Initialize session state
if 'web3' not in st.session_state:
    st.session_state.web3 = None
if 'account' not in st.session_state:
    st.session_state.account = None
if 'contract' not in st.session_state:
    st.session_state.contract = None
if 'last_refresh' not in st.session_state:
    st.session_state.last_refresh = None

def initialize_web3(rpc_url: str, private_key: str):
    """Initialize Web3 connection and account"""
    try:
        with st.spinner("Connecting to blockchain..."):
            # Connect to blockchain with timeout settings
            # Set request timeout to 5 seconds for faster failures
            from web3.providers import HTTPProvider
            from web3 import Web3 as Web3Class
            
            provider = HTTPProvider(
                rpc_url,
                request_kwargs={
                    'timeout': 5  # 5 second timeout per request
                }
            )
            w3 = Web3Class(provider)
            
            # Add POA middleware for compatibility
            try:
                from web3.middleware.proof_of_authority import ExtraDataToPOAMiddleware
                w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
            except ImportError:
                pass
            
            if not w3.is_connected():
                st.error("❌ Failed to connect to blockchain")
                return False
            
            # Load account from private key
            if not private_key.startswith('0x'):
                private_key = '0x' + private_key
            
            account = Account.from_key(private_key)
            
            # Initialize contract
            contract = w3.eth.contract(
                address=Web3.to_checksum_address(CONTRACT_ADDRESS),
                abi=CONTRACT_ABI
            )
            
            # Store in session state
            st.session_state.web3 = w3
            st.session_state.account = account
            st.session_state.contract = contract
            st.session_state.last_refresh = datetime.now()
            
            return True
    except Exception as e:
        st.error(f"❌ Error initializing Web3: {str(e)}")
        return False

# Main UI
st.title("📊 Voting Workshop Backup Dashboard")

# Connection section
if not st.session_state.account:
    st.subheader("🔌 Connect to Blockchain")
    
    col1, col2 = st.columns([2, 2])
    
    with col1:
        # Try to load from secrets first
        try:
            default_rpc = st.secrets.get("RPC_ENDPOINT", DEFAULT_RPC_URL)
        except:
            default_rpc = DEFAULT_RPC_URL
        
        rpc_url = st.text_input(
            "RPC URL",
            value=default_rpc,
            type="default",
            help="Blockchain RPC endpoint"
        )
    
    with col2:
        private_key = st.text_input(
            "Wallet Private Key",
            type="password",
            help="Your wallet private key (owner only)"
        )
    
    if st.button("🔌 Connect", type="primary", width='content'):
        if not private_key:
            st.error("Please enter your wallet private key")
        else:
            if initialize_web3(rpc_url, private_key):
                st.success(f"✅ Connected!")
                st.rerun()
    
    st.divider()
    st.caption(f"Contract: {CONTRACT_ADDRESS} | Network: Status Sepolia")

else:
    # Connected status bar
    col1, col2, col3, col4 = st.columns([3, 2, 2, 1])
    
    with col1:
        st.success(f"✅ Connected: {st.session_state.account.address[:10]}...{st.session_state.account.address[-8:]}")
    
    with col2:
        st.caption(f"Network: Status Sepolia")
    
    with col3:
        if st.session_state.last_refresh:
            st.caption(f"Last refresh: {st.session_state.last_refresh.strftime('%H:%M:%S')}")
    
    with col4:
        if st.button("🔄 Refresh", width='stretch'):
            st.session_state.last_refresh = datetime.now()
            st.rerun()
    
    st.divider()
    
    # Main content area
    st.header("📊 Election Information")
    
    # Vote selection
    col_input1, col_input2 = st.columns([3, 1])
    
    with col_input1:
        # Create vote selection dropdown
        vote_options_list = [f"{config['title']} (ID: {config['electionId']})" for config in VOTE_CONFIGS.values()]
        vote_keys_list = list(VOTE_CONFIGS.keys())
        
        selected_vote_index = st.selectbox(
            "Select Vote",
            options=range(len(vote_options_list)),
            format_func=lambda x: vote_options_list[x],
            key="vote_selection",
            help="Select a vote to view its information and results"
        )
        
        selected_vote_key = vote_keys_list[selected_vote_index]
        selected_vote_config = VOTE_CONFIGS[selected_vote_key]
        
        # Display vote info
        st.caption(f"**Type:** {selected_vote_config['type'].title()} | **Election ID:** {selected_vote_config['electionId']} | **Options:** {len(selected_vote_config['options'])}")
    
    with col_input2:
        st.markdown("<br>", unsafe_allow_html=True)  # Spacer for alignment
        get_info_button = st.button("🔍 Get Info", type="primary", width='stretch')
    
    # Always show results area
    results_container = st.container()
    
    with results_container:
        if get_info_button:
            # Store the query in session state
            st.session_state.current_vote_key = selected_vote_key
            st.session_state.show_results = True
        
        # Display results if we have queried before
        if st.session_state.get('show_results', False):
            query_vote_key = st.session_state.get('current_vote_key', vote_keys_list[0])
            query_vote_config = VOTE_CONFIGS.get(query_vote_key, selected_vote_config)
            query_election_id = query_vote_config['electionId']
            query_options = query_vote_config['options']
            query_num_choices = len(query_options)
            
            try:
                contract = st.session_state.contract
                
                # Get election details
                with st.spinner("Fetching election data..."):
                    election = contract.functions.getElection(query_election_id).call()
                    vote_count = contract.functions.getVoteCount(query_election_id).call()
                    is_public = election[2]  # Index 2 is isPublic
                
                # Display election information
                st.success(f"✅ {query_vote_config['title']} (Election #{query_election_id}) found!")
                
                col1, col2 = st.columns(2)
                
                with col1:
                    # Display if election is public or private
                    if is_public:
                        st.metric("🌐 Election Type", "Public", help="This election is public")
                    else:
                        st.metric("🔒 Election Type", "Private", help="This election is private")
                
                with col2:
                    # Display vote count
                    st.metric("🗳️ Number of Votes", vote_count)
                
                # Additional election info
                with st.expander("📋 Additional Details"):
                    status_names = ["Created", "Open", "Closed"]
                    status = election[1]  # Index 1 is status
                    st.write(f"**Status:** {status_names[status] if status < len(status_names) else 'Unknown'}")
                    st.write(f"**Election ID:** {election[0]}")
                    
                    if election[3] > 0:  # openedAt
                        opened_date = datetime.fromtimestamp(election[3])
                        st.write(f"**Opened At:** {opened_date.strftime('%Y-%m-%d %H:%M:%S')}")
                    
                    if election[4] > 0:  # closedAt
                        closed_date = datetime.fromtimestamp(election[4])
                        st.write(f"**Closed At:** {closed_date.strftime('%Y-%m-%d %H:%M:%S')}")
                
                # If public, show results
                if is_public and vote_count > 0:
                    st.divider()
                    st.subheader("📊 Election Results")
                    
                    with st.spinner("Loading results..."):
                        # Fetch results from contract
                        results = contract.functions.getElectionResults(query_election_id, query_num_choices).call()
                        
                        # Get all votes to show who voted for what (if function exists)
                        user_ids = []
                        choices = []
                        try:
                            all_votes = contract.functions.getAllPublicVotes(query_election_id).call()
                            user_ids = all_votes[0]
                            choices = all_votes[1]
                        except Exception as e:
                            # Function might not exist in this contract version
                            st.warning(f"⚠️ Could not fetch individual votes: {str(e)}")
                            user_ids = []
                            choices = []
                        
                        # Create option labels from vote config
                        option_labels = [opt['text'] for opt in query_options]
                        
                        # Create results dataframe
                        df = pd.DataFrame({
                            'Option': option_labels,
                            'Votes': list(results)
                        })
                        
                        # Calculate percentages
                        total_votes = sum(results)
                        df['Percentage'] = (df['Votes'] / total_votes * 100).round(1) if total_votes > 0 else 0
                        
                        # Find winner(s)
                        max_votes = df['Votes'].max()
                        winners = df[df['Votes'] == max_votes]['Option'].tolist()
                        
                        # Display winner
                        if len(winners) == 1:
                            st.success(f"🏆 Winner: **{winners[0]}** with {max_votes} votes ({df[df['Votes'] == max_votes]['Percentage'].values[0]:.1f}%)")
                        else:
                            st.warning(f"🤝 Tie between: **{', '.join(winners)}** with {max_votes} votes each")
                        
                        # Create visualization
                        col1, col2 = st.columns([2, 1])
                        
                        with col1:
                            # Create horizontal bar chart with Plotly
                            colors = ['#ff6b6b' if v == max_votes else '#4ecdc4' for v in df['Votes']]
                            
                            fig = go.Figure(data=[
                                go.Bar(
                                    y=df['Option'],
                                    x=df['Votes'],
                                    orientation='h',
                                    marker=dict(
                                        color=colors,
                                        line=dict(color='rgba(0,0,0,0.1)', width=1)
                                    ),
                                    text=[f"{v} ({p:.1f}%)" for v, p in zip(df['Votes'], df['Percentage'])],
                                    textposition='outside',
                                    hovertemplate='<b>%{y}</b><br>Votes: %{x}<br><extra></extra>'
                                )
                            ])
                            
                            fig.update_layout(
                                title="Vote Distribution",
                                xaxis_title="Number of Votes",
                                yaxis_title="",
                                height=max(300, len(option_labels) * 60),
                                showlegend=False,
                                plot_bgcolor='rgba(0,0,0,0)',
                                paper_bgcolor='rgba(0,0,0,0)',
                                margin=dict(l=20, r=20, t=40, b=20),
                                font=dict(size=12)
                            )
                            
                            fig.update_xaxes(gridcolor='rgba(128,128,128,0.2)')
                            fig.update_yaxes(gridcolor='rgba(128,128,128,0.2)')
                            
                            st.plotly_chart(fig, width='stretch')
                        
                        with col2:
                            # Display summary table
                            st.markdown("### Summary")
                            for _, row in df.iterrows():
                                emoji = "🏆" if row['Votes'] == max_votes else "📊"
                                st.markdown(f"{emoji} **{row['Option']}**")
                                st.markdown(f"  {row['Votes']} votes ({row['Percentage']:.1f}%)")
                                st.markdown("")
                    
                    # Display individual votes table
                    st.divider()
                    st.subheader("👥 Individual Votes")
                    
                    if len(user_ids) > 0:
                        # Create votes dataframe with actual option names
                        choice_names = []
                        for choice in choices:
                            choice_idx = int(choice) - 1  # Convert to 0-based index
                            if 0 <= choice_idx < len(query_options):
                                choice_names.append(query_options[choice_idx]['text'])
                            else:
                                choice_names.append(f"Option {int(choice)}")
                        
                        votes_df = pd.DataFrame({
                            'User ID': [int(uid) for uid in user_ids],
                            'Choice': choice_names
                        })
                        
                        # Sort by User ID for better readability
                        votes_df = votes_df.sort_values('User ID').reset_index(drop=True)
                        
                        # Display table
                        st.dataframe(
                            votes_df,
                            width='stretch',
                            hide_index=True,
                            height=min(400, 50 + len(votes_df) * 35)
                        )
                        
                        st.caption(f"Total: {len(votes_df)} votes")
                        
                        # Download button for public votes
                        csv = votes_df.to_csv(index=False)
                        st.download_button(
                            label="📥 Download Public Votes (CSV)",
                            data=csv,
                            file_name=f"public_votes_election_{query_election_id}.csv",
                            mime="text/csv",
                            width='stretch'
                        )
                    else:
                        st.info("No votes recorded yet.")
                
                # If private, show encrypted votes
                elif not is_public and vote_count > 0:
                    st.divider()
                    st.subheader("🔒 Private Votes")
                    
                    # Decryption settings
                    with st.expander("🔑 Decryption Settings", expanded=False):
                        decryption_key = st.text_input(
                            "Decryption Key (Base64)",
                            value=DEFAULT_DECRYPTION_KEY,
                            type="password",
                            help="Base64 encoded private key for decryption"
                        )
                        
                        # Generate signature options from vote config
                        signature_options = get_vote_signature_options(query_vote_config)
                        
                        st.markdown("**Signature Options (auto-generated from vote config):**")
                        st.text_area(
                            "Options",
                            value="\n".join(signature_options),
                            height=150,
                            disabled=True,
                            help="These are the signature messages that users signed. Auto-generated from vote configuration."
                        )
                        vote_options = signature_options
                    
                    with st.spinner("Loading encrypted votes..."):
                        try:
                            # Get all private votes (encrypted)
                            private_votes = contract.functions.getAllPrivateVotes(query_election_id).call()
                            private_user_ids = private_votes[0]
                            encrypted_signatures = private_votes[1]
                            
                            if len(private_user_ids) > 0:
                                # First show encrypted data (collapsible)
                                with st.expander("📦 Encrypted Data", expanded=False):
                                    encrypted_df = pd.DataFrame({
                                        'User ID': [int(uid) for uid in private_user_ids],
                                        'Encrypted Data (Hex)': [sig.hex() for sig in encrypted_signatures]
                                    })
                                    encrypted_df = encrypted_df.sort_values('User ID').reset_index(drop=True)
                                    
                                    st.dataframe(
                                        encrypted_df,
                                        width='stretch',
                                        hide_index=True,
                                        height=min(300, 50 + len(encrypted_df) * 35)
                                    )
                                
                                # Decrypt votes if key is provided
                                if decryption_key and len(vote_options) > 0:
                                    st.divider()
                                    
                                    # Decrypted votes section (collapsible)
                                    with st.expander("🔓 Decrypted Votes", expanded=False):
                                        with st.spinner("Decrypting votes..."):
                                            decrypted_votes = []
                                            failed_decrypts = []
                                            
                                            # Get voter addresses
                                            user_id_to_address = {}
                                            for user_id in private_user_ids:
                                                try:
                                                    address = contract.functions.idToAddress(user_id).call()
                                                    user_id_to_address[int(user_id)] = address
                                                except Exception as e:
                                                    st.warning(f"Could not fetch address for user #{user_id}: {str(e)}")
                                            
                                            # Decrypt each vote
                                            for i, (user_id, encrypted_sig) in enumerate(zip(private_user_ids, encrypted_signatures)):
                                                try:
                                                    user_address = user_id_to_address.get(int(user_id))
                                                    if not user_address:
                                                        failed_decrypts.append({
                                                            'User ID': int(user_id),
                                                            'Error': 'Address not found'
                                                        })
                                                        continue
                                                    
                                                    # Decrypt and verify
                                                    result = decrypt_and_verify_vote(
                                                        encrypted_sig,
                                                        user_address,
                                                        decryption_key,
                                                        vote_options
                                                    )
                                                    
                                                    if result['vote']:
                                                        # Get the actual option text from vote config
                                                        option_idx = result['vote']['optionIndex']
                                                        if 0 <= option_idx < len(query_options):
                                                            option_text = query_options[option_idx]['text']
                                                        else:
                                                            option_text = result['vote']['optionText']
                                                        
                                                        decrypted_votes.append({
                                                            'User ID': int(user_id),
                                                            'Choice': option_text,
                                                            'Vote Text': result['vote']['optionText']
                                                        })
                                                    else:
                                                        failed_decrypts.append({
                                                            'User ID': int(user_id),
                                                            'Error': 'Signature verification failed'
                                                        })
                                                except Exception as e:
                                                    failed_decrypts.append({
                                                        'User ID': int(user_id),
                                                        'Error': str(e)
                                                    })
                                            
                                            # Store decrypted votes for display outside expander
                                            if decrypted_votes:
                                                st.success(f"✅ Successfully decrypted {len(decrypted_votes)} vote(s)")
                                                
                                                # Store in session state for access outside expander
                                                st.session_state[f'decrypted_votes_{query_election_id}'] = decrypted_votes
                                                st.session_state[f'failed_decrypts_{query_election_id}'] = failed_decrypts
                                                
                                                # Display individual votes table inside expander
                                                st.divider()
                                                st.subheader("👥 Individual Votes")
                                                
                                                decrypted_df = pd.DataFrame(decrypted_votes)
                                                decrypted_df = decrypted_df.sort_values('User ID').reset_index(drop=True)
                                                
                                                st.dataframe(
                                                    decrypted_df,
                                                    width='stretch',
                                                    hide_index=True,
                                                    height=min(400, 50 + len(decrypted_df) * 35)
                                                )
                                                
                                                st.caption(f"Total decrypted: {len(decrypted_votes)} vote(s)")
                                else:
                                    st.info("💡 Enter decryption key and vote options above to decrypt votes.")
                                
                            else:
                                st.info("No encrypted votes recorded yet.")
                            
                            # Display results overview and download button outside expander (if decrypted)
                            if decryption_key and len(vote_options) > 0:
                                decrypted_votes = st.session_state.get(f'decrypted_votes_{query_election_id}', [])
                                failed_decrypts = st.session_state.get(f'failed_decrypts_{query_election_id}', [])
                                
                                if decrypted_votes:
                                    st.divider()
                                    st.subheader("📊 Election Results")
                                    
                                    # Count votes per option
                                    option_vote_counts = {}
                                    for opt in query_options:
                                        option_vote_counts[opt['text']] = 0
                                    
                                    for vote in decrypted_votes:
                                        choice_text = vote['Choice']
                                        if choice_text in option_vote_counts:
                                            option_vote_counts[choice_text] += 1
                                    
                                    # Create results dataframe
                                    option_labels = [opt['text'] for opt in query_options]
                                    vote_counts = [option_vote_counts[opt['text']] for opt in query_options]
                                    
                                    results_df = pd.DataFrame({
                                        'Option': option_labels,
                                        'Votes': vote_counts
                                    })
                                    
                                    # Calculate percentages
                                    total_decrypted = len(decrypted_votes)
                                    results_df['Percentage'] = (results_df['Votes'] / total_decrypted * 100).round(1) if total_decrypted > 0 else 0
                                    
                                    # Find winner(s)
                                    max_votes = results_df['Votes'].max()
                                    winners = results_df[results_df['Votes'] == max_votes]['Option'].tolist()
                                    
                                    # Display winner
                                    if len(winners) == 1:
                                        st.success(f"🏆 Winner: **{winners[0]}** with {max_votes} votes ({results_df[results_df['Votes'] == max_votes]['Percentage'].values[0]:.1f}%)")
                                    else:
                                        st.warning(f"🤝 Tie between: **{', '.join(winners)}** with {max_votes} votes each")
                                    
                                    # Create visualization
                                    col1, col2 = st.columns([2, 1])
                                    
                                    with col1:
                                        # Create horizontal bar chart with Plotly
                                        colors = ['#ff6b6b' if v == max_votes else '#a78bfa' for v in results_df['Votes']]
                                        
                                        fig = go.Figure(data=[
                                            go.Bar(
                                                y=results_df['Option'],
                                                x=results_df['Votes'],
                                                orientation='h',
                                                marker=dict(
                                                    color=colors,
                                                    line=dict(color='rgba(0,0,0,0.1)', width=1)
                                                ),
                                                text=[f"{v} ({p:.1f}%)" for v, p in zip(results_df['Votes'], results_df['Percentage'])],
                                                textposition='outside',
                                                hovertemplate='<b>%{y}</b><br>Votes: %{x}<br><extra></extra>'
                                            )
                                        ])
                                        
                                        fig.update_layout(
                                            title="Vote Distribution",
                                            xaxis_title="Number of Votes",
                                            yaxis_title="",
                                            height=max(300, len(option_labels) * 60),
                                            showlegend=False,
                                            plot_bgcolor='rgba(0,0,0,0)',
                                            paper_bgcolor='rgba(0,0,0,0)',
                                            margin=dict(l=20, r=20, t=40, b=20),
                                            font=dict(size=12)
                                        )
                                        
                                        fig.update_xaxes(gridcolor='rgba(128,128,128,0.2)')
                                        fig.update_yaxes(gridcolor='rgba(128,128,128,0.2)')
                                        
                                        st.plotly_chart(fig, width='stretch')
                                    
                                    with col2:
                                        # Display summary table
                                        st.markdown("### Summary")
                                        for _, row in results_df.iterrows():
                                            emoji = "🏆" if row['Votes'] == max_votes else "📊"
                                            st.markdown(f"{emoji} **{row['Option']}**")
                                            st.markdown(f"  {row['Votes']} votes ({row['Percentage']:.1f}%)")
                                            st.markdown("")
                                    
                                    # Download button for decrypted votes
                                    decrypted_df = pd.DataFrame(decrypted_votes)
                                    decrypted_df = decrypted_df.sort_values('User ID').reset_index(drop=True)
                                    csv = decrypted_df.to_csv(index=False)
                                    st.download_button(
                                        label="📥 Download Decrypted Votes (CSV)",
                                        data=csv,
                                        file_name=f"decrypted_votes_election_{query_election_id}.csv",
                                        mime="text/csv",
                                        width='stretch'
                                    )
                                    
                                    # Show failed decryptions if any
                                    if failed_decrypts:
                                        st.warning(f"⚠️ Failed to decrypt {len(failed_decrypts)} vote(s)")
                                        failed_df = pd.DataFrame(failed_decrypts)
                                        st.dataframe(
                                            failed_df,
                                            width='stretch',
                                            hide_index=True
                                        )
                                
                        except Exception as e:
                            st.warning(f"⚠️ Could not fetch encrypted votes: {str(e)}")
            
            except Exception as e:
                if "execution reverted" in str(e).lower() or "invalid election" in str(e).lower():
                    st.error(f"❌ Election #{query_election_id} does not exist or is invalid.")
                else:
                    st.error(f"❌ Error fetching election data: {str(e)}")

