"""
Voting Workshop Management Dashboard
A Streamlit application for managing elections and viewing results.
"""

import streamlit as st
import json
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
import time
from datetime import datetime
import base64
import nacl.public
import nacl.utils

# Page configuration
st.set_page_config(
    page_title="Voting Workshop Dashboard",
    page_icon="🗳️",
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
CONTRACT_ADDRESS = "0x0918E5b67187400548571D372D381C4bB4B9B27b"

# Default RPC endpoint
DEFAULT_RPC_URL = "https://public.sepolia.rpc.status.network"

# Decryption key for private votes (Base64 encoded)
DECRYPTION_KEY = "UgsmFEqNQrYE32riH1Ph0mBV7g2IVQ1FIXPEbTyb0zY="

# Contract ABI (simplified - only the functions we need)
CONTRACT_ABI = json.loads('''[
    {
        "inputs": [{"internalType": "uint256", "name": "electionId", "type": "uint256"}, {"internalType": "bool", "name": "isPublic", "type": "bool"}],
        "name": "openElection",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "electionId", "type": "uint256"}],
        "name": "closeElection",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTotalRegistered",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getTotalElections",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "electionId", "type": "uint256"}],
        "name": "getElection",
        "outputs": [{
            "components": [
                {"internalType": "uint256", "name": "id", "type": "uint256"},
                {"internalType": "enum VotingWorkshop.ElectionStatus", "name": "status", "type": "uint8"},
                {"internalType": "bool", "name": "isPublic", "type": "bool"},
                {"internalType": "uint256", "name": "openedAt", "type": "uint256"},
                {"internalType": "uint256", "name": "closedAt", "type": "uint256"}
            ],
            "internalType": "struct VotingWorkshop.Election",
            "name": "",
            "type": "tuple"
        }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "electionId", "type": "uint256"}],
        "name": "getVoteCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "electionId", "type": "uint256"}, {"internalType": "uint256", "name": "numChoices", "type": "uint256"}],
        "name": "getElectionResults",
        "outputs": [{"internalType": "uint256[]", "name": "counts", "type": "uint256[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "name": "electionIds",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "electionId", "type": "uint256"}],
        "name": "getAllPublicVotes",
        "outputs": [
            {"internalType": "uint256[]", "name": "userIds", "type": "uint256[]"},
            {"internalType": "uint256[]", "name": "choices", "type": "uint256[]"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "name": "idToAddress",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "addressToId",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "electionId", "type": "uint256"}],
        "name": "getAllPrivateVotes",
        "outputs": [
            {"internalType": "uint256[]", "name": "userIds", "type": "uint256[]"},
            {"internalType": "bytes[]", "name": "signatures", "type": "bytes[]"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
]''')

# Vote configuration
VOTE_CONFIGS = {
    1: {"name": "Training Ground", "type": "public", "options": 4},
    2: {"name": "Vote 1a: Coordination", "type": "public", "options": 4},
    3: {"name": "Vote 1b: Private Coordination", "type": "private", "options": 4},
    4: {"name": "Vote 2a: Strategic Initiative - Round 1", "type": "public", "options": 4},
    5: {"name": "Vote 2b: Strategic Initiative - Round 2", "type": "public", "options": 4},
    6: {"name": "Vote 2c: Strategic Initiative - Round 3", "type": "private", "options": 4},
    7: {"name": "Vote 2d: Strategic Initiative - Round 4", "type": "private", "options": 4},
    8: {"name": "Vote 3: Merit vs Luck", "type": "public", "options": 2},
}

# Vote options for verification (must match what users signed)
PRIVATE_VOTE_OPTIONS = {
    3: [  # Vote 1b
        "I vote for District A",
        "I vote for District B",
        "I vote for District C",
        "I vote for District D",
    ],
    6: [  # Vote 2c
        "I vote for A – Citywide Campaign (Marketing)",
        "I vote for B – Process Upgrade (Operations)",
        "I vote for C – Community Program (Community)",
        "I vote for D – Shared Hub (Everyone)",
    ],
    7: [  # Vote 2d
        "I vote for A – Citywide Campaign (Marketing)",
        "I vote for B – Process Upgrade (Operations)",
        "I vote for C – Community Program (Community)",
        "I vote for D – Shared Hub (Everyone, bonus if ≥50%)",
    ],
}

# Decryption functions
def extract_encrypted_signature(tx_input_data):
    """Extract encrypted signature from transaction input data"""
    hex_data = tx_input_data.hex() if isinstance(tx_input_data, bytes) else tx_input_data
    if hex_data.startswith('0x'):
        hex_data = hex_data[2:]
    
    # Parse transaction format:
    # Function selector: 4 bytes (8 hex chars)
    # Election ID: 32 bytes (64 hex chars)
    # Offset: 32 bytes (64 hex chars)
    # Length: 32 bytes at position 136-200
    length_hex = hex_data[136:200]
    length = int(length_hex, 16)
    
    # Encrypted signature starts at position 200
    encrypted_hex = hex_data[200:200 + (length * 2)]
    
    # Convert hex to bytes
    encrypted_bytes = bytes.fromhex(encrypted_hex)
    
    # Convert to base64
    return base64.b64encode(encrypted_bytes).decode('utf-8')

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
            except:
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

# Initialize session state
if 'web3' not in st.session_state:
    st.session_state.web3 = None
if 'account' not in st.session_state:
    st.session_state.account = None
if 'contract' not in st.session_state:
    st.session_state.contract = None
if 'last_refresh' not in st.session_state:
    st.session_state.last_refresh = None
if 'decryption_key' not in st.session_state:
    st.session_state.decryption_key = None

def initialize_web3(rpc_url: str, private_key: str, decryption_key: str = None):
    """Initialize Web3 connection and account"""
    try:
        with st.spinner("Connecting to blockchain..."):
            # Connect to blockchain
            w3 = Web3(Web3.HTTPProvider(rpc_url))
            
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
            st.session_state.decryption_key = decryption_key
            st.session_state.last_refresh = datetime.now()
            
            return True
    except Exception as e:
        st.error(f"❌ Error initializing Web3: {str(e)}")
        return False

def get_user_address_from_id(contract, user_id):
    """Get user address from user ID"""
    try:
        # Try to call userAddresses mapping
        # Note: We need to add this to the ABI if not present
        # For now, we'll need to track this differently
        return None
    except:
        return None

def fetch_private_votes(w3, contract_address, election_id, from_block=0):
    """Fetch all castPrivateVote transactions for a given election"""
    try:
        # Get logs for castPrivateVote events or fetch transactions
        # We need to filter transactions that called castPrivateVote
        latest_block = w3.eth.block_number
        
        votes = []
        # This is a simplified approach - in production you'd want to use events
        # For now, we'll fetch transactions from recent blocks
        # A better approach would be to have the contract emit events
        
        return votes
    except Exception as e:
        st.error(f"Error fetching private votes: {str(e)}")
        return []

def get_election_status(election_data):
    """Parse election status"""
    status_code = election_data[1]
    return "Open" if status_code == 1 else "Closed"

def open_election(election_id: int, is_public: bool):
    """Open an election"""
    try:
        w3 = st.session_state.web3
        account = st.session_state.account
        contract = st.session_state.contract
        
        with st.spinner(f"Opening election {election_id}..."):
            # Build transaction
            txn = contract.functions.openElection(election_id, is_public).build_transaction({
                'from': account.address,
                'nonce': w3.eth.get_transaction_count(account.address),
                'gas': 200000,
                'gasPrice': w3.eth.gas_price,
            })
            
            # Sign and send transaction
            signed_txn = w3.eth.account.sign_transaction(txn, account.key)
            tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            
            # Wait for transaction receipt
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
            
            if receipt['status'] == 1:
                st.success(f"✅ Election {election_id} opened successfully! Tx: {tx_hash.hex()[:10]}...")
                time.sleep(1)  # Give blockchain time to update
                return True
            else:
                st.error("❌ Transaction failed")
                return False
    except Exception as e:
        st.error(f"❌ Error opening election: {str(e)}")
        return False

def close_election(election_id: int):
    """Close an election"""
    try:
        w3 = st.session_state.web3
        account = st.session_state.account
        contract = st.session_state.contract
        
        with st.spinner(f"Closing election {election_id}..."):
            # Build transaction
            txn = contract.functions.closeElection(election_id).build_transaction({
                'from': account.address,
                'nonce': w3.eth.get_transaction_count(account.address),
                'gas': 200000,
                'gasPrice': w3.eth.gas_price,
            })
            
            # Sign and send transaction
            signed_txn = w3.eth.account.sign_transaction(txn, account.key)
            tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
            
            # Wait for transaction receipt
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
            
            if receipt['status'] == 1:
                st.success(f"✅ Election {election_id} closed successfully! Tx: {tx_hash.hex()[:10]}...")
                time.sleep(1)  # Give blockchain time to update
                return True
            else:
                st.error("❌ Transaction failed")
                return False
    except Exception as e:
        st.error(f"❌ Error closing election: {str(e)}")
        return False

# Main UI
st.title("🗳️ Voting Workshop Management Dashboard")

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
    
    if st.button("🔌 Connect", type="primary", use_container_width=False):
        if not private_key:
            st.error("Please enter your wallet private key")
        else:
            # Use hardcoded decryption key
            if initialize_web3(rpc_url, private_key, DECRYPTION_KEY):
                st.success(f"✅ Connected!")
                if DECRYPTION_KEY:
                    st.info("🔐 Private vote decryption enabled")
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

# Main content
if st.session_state.web3 and st.session_state.contract:
    contract = st.session_state.contract
    
    # Registration stats
    st.header("📊 Overview")
    try:
        with st.spinner("Loading statistics..."):
            total_registered = contract.functions.getTotalRegistered().call()
            total_elections = contract.functions.getTotalElections().call()
        
            # Count open elections and total votes
            open_count = 0
            total_votes_cast = 0
            for eid in range(1, total_elections + 1):
                try:
                    election_data = contract.functions.getElection(eid).call()
                    status = get_election_status(election_data)
                    if status == "Open":
                        open_count += 1
                    
                    # Get vote count for this election
                    try:
                        vote_count = contract.functions.getVoteCount(eid).call()
                        total_votes_cast += vote_count
                    except:
                        pass
                except:
                    pass
        
        # Create 4-column layout with modern metrics
        col1, col2, col3, col4 = st.columns(4)
        
        with col1:
            st.markdown("""
            <div style="padding: 1.5rem; border-radius: 0.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">Registered Users</div>
                <div style="font-size: 2.5rem; font-weight: 700;">{}</div>
            </div>
            """.format(total_registered), unsafe_allow_html=True)
        
        with col2:
            st.markdown("""
            <div style="padding: 1.5rem; border-radius: 0.5rem; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white;">
                <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">Total Elections</div>
                <div style="font-size: 2.5rem; font-weight: 700;">{}</div>
            </div>
            """.format(total_elections), unsafe_allow_html=True)
        
        with col3:
            st.markdown("""
            <div style="padding: 1.5rem; border-radius: 0.5rem; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white;">
                <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">Open Elections</div>
                <div style="font-size: 2.5rem; font-weight: 700;">{}</div>
            </div>
            """.format(open_count), unsafe_allow_html=True)
        
        with col4:
            avg_participation = (total_votes_cast / total_elections / total_registered * 100) if total_registered > 0 and total_elections > 0 else 0
            st.markdown("""
            <div style="padding: 1.5rem; border-radius: 0.5rem; background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white;">
                <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">Avg Participation</div>
                <div style="font-size: 2.5rem; font-weight: 700;">{:.1f}%</div>
            </div>
            """.format(avg_participation), unsafe_allow_html=True)
        
    except Exception as e:
        st.error(f"❌ Error fetching statistics: {str(e)}")
    
    st.divider()
    
    # Elections management
    st.header("🗳️ Elections Management")
    
    # Tabs for different views
    tab1, tab2 = st.tabs(["📋 All Elections", "➕ Create New Election"])
    
    with tab1:
        # Display all configured elections in a grid
        for election_id, config in VOTE_CONFIGS.items():
            # Always fetch fresh data
            try:
                election_data = contract.functions.getElection(election_id).call()
                status = get_election_status(election_data)
                
                # For public votes, calculate from results
                if config['type'] == 'public':
                    results = contract.functions.getElectionResults(election_id, config['options']).call()
                    vote_count = sum(results)
                else:
                    # For private votes, use getVoteCount
                    vote_count = contract.functions.getVoteCount(election_id).call()
                
            except Exception as e:
                status = "Not Created"
                vote_count = 0
            
            # Status badge colors
            if status == "Open":
                status_color = "#28a745"
                status_icon = "🟢"
            elif status == "Closed":
                status_color = "#dc3545"
                status_icon = "🔴"
            else:
                status_color = "#6c757d"
                status_icon = "⚪"
            
            # Type badge
            type_icon = "👁️" if config['type'] == 'public' else "🔐"
            
            # Create a card-like container
            with st.container():
                st.markdown(f"""
                <div style="padding: 1rem; border-radius: 0.5rem; border: 1px solid #e0e0e0; margin-bottom: 1rem; background-color: #fafafa;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <div>
                            <span style="font-size: 1.1rem; font-weight: 600;">Election {election_id}: {config['name']}</span>
                        </div>
                        <div>
                            <span style="background-color: {status_color}; color: white; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.85rem; font-weight: 500;">{status_icon} {status}</span>
                            <span style="margin-left: 0.5rem; background-color: #6c757d; color: white; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.85rem;">{type_icon} {config['type'].title()}</span>
                        </div>
                    </div>
                </div>
                """, unsafe_allow_html=True)
                
                col1, col2, col3, col4 = st.columns([1, 1, 1, 2])
                
                with col1:
                    st.metric("Votes Cast", vote_count)
                
                with col2:
                    st.metric("Options", config['options'])
                
                with col3:
                    st.write("")  # spacing
                
                with col4:
                    # Control buttons
                    if status == "Open":
                        if st.button(f"🔒 Close Election", key=f"close_{election_id}", type="secondary", use_container_width=True):
                            if close_election(election_id):
                                st.rerun()
                    elif status == "Closed":
                        if st.button(f"🔓 Reopen Election", key=f"reopen_{election_id}", type="secondary", use_container_width=True):
                            if open_election(election_id, config['type'] == 'public'):
                                st.rerun()
                    else:  # Not created
                        if st.button(f"✨ Create & Open", key=f"create_{election_id}", type="primary", use_container_width=True):
                            if open_election(0, config['type'] == 'public'):
                                st.rerun()
                
                st.markdown("---")
    
    st.divider()
    
    # Results section
    st.header("📊 Election Results")
    
    # Display all elections with votes
    for election_id, config in VOTE_CONFIGS.items():
        # Fetch fresh data
        try:
            election_data = contract.functions.getElection(election_id).call()
            status = get_election_status(election_data)
            
            # For public votes, calculate from results (like in the app)
            if config['type'] == 'public':
                results = contract.functions.getElectionResults(election_id, config['options']).call()
                vote_count = sum(results)
            else:
                # For private votes, use getVoteCount
                vote_count = contract.functions.getVoteCount(election_id).call()
        except:
            vote_count = 0
            status = 'Not Created'
        
        # Only show if election exists
        if status in ['Open', 'Closed']:
            with st.expander(f"**Election {election_id}**: {config['name']}", expanded=(vote_count > 0 and status == 'Closed')):
                
                if config['type'] == 'public' and vote_count > 0:
                    # Fetch and display public vote results
                    results = contract.functions.getElectionResults(election_id, config['options']).call()
                    
                    # Get all votes to show voter IDs per choice
                    all_votes = contract.functions.getAllPublicVotes(election_id).call()
                    user_ids = all_votes[0]
                    choices = all_votes[1]
                    
                    # Group voters by their choice
                    voters_by_choice = {}
                    for user_id, choice in zip(user_ids, choices):
                        if choice not in voters_by_choice:
                            voters_by_choice[choice] = []
                        voters_by_choice[choice].append(int(user_id))
                    
                    # Display results as bar chart
                    option_labels = []
                    if config['options'] == 4:
                        if "District" in config['name'] or "Coordination" in config['name']:
                            option_labels = ["District A", "District B", "District C", "District D"]
                        else:
                            option_labels = ["Option A", "Option B", "Option C", "Option D"]
                    elif config['options'] == 2:
                        option_labels = ["Award to 3rd place", "Random draw"]
                    else:
                        option_labels = [f"Option {i+1}" for i in range(config['options'])]
                    
                    # Create results dataframe
                    df = pd.DataFrame({
                        'Option': option_labels,
                        'Votes': list(results),
                        'VoterIDs': [voters_by_choice.get(i+1, []) for i in range(len(option_labels))]
                    })
                    
                    # Calculate percentages
                    df['Percentage'] = (df['Votes'] / vote_count * 100).round(1)
                    
                    # Find winner
                    max_votes = df['Votes'].max()
                    winners = df[df['Votes'] == max_votes]['Option'].tolist()
                    
                    # Create modern visualization with Plotly
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
                            title=dict(
                                text=f"Results: {config['name']}",
                                font=dict(size=16, color='#333')
                            ),
                            xaxis_title="Number of Votes",
                            yaxis_title="",
                            height=max(300, len(option_labels) * 80),
                            margin=dict(l=20, r=100, t=60, b=40),
                            plot_bgcolor='rgba(0,0,0,0)',
                            paper_bgcolor='rgba(0,0,0,0)',
                            font=dict(size=12),
                            xaxis=dict(
                                showgrid=True,
                                gridcolor='rgba(0,0,0,0.05)'
                            ),
                            yaxis=dict(
                                showgrid=False,
                                categoryorder='total ascending'
                            )
                        )
                        
                        st.plotly_chart(fig, use_container_width=True)
                    
                    with col2:
                        # Winner announcement
                        st.markdown("### 🏆 Result")
                        if len(winners) == 1:
                            st.success(f"**{winners[0]}**")
                            st.metric("Winning Votes", max_votes)
                            st.metric("Margin", f"{(df['Votes'].max() / vote_count * 100):.1f}%")
                        else:
                            st.info(f"**Tie**")
                            st.write(f"{', '.join(winners)}")
                            st.metric("Tied Votes", max_votes)
                        
                        st.divider()
                        st.metric("Total Votes", vote_count)
                        st.metric("Turnout Rate", f"{(vote_count / st.session_state.contract.functions.getTotalRegistered().call() * 100):.1f}%" if vote_count > 0 else "0%")
                    
                    # Detailed breakdown in collapsible section
                    with st.expander("📋 Detailed Voter Breakdown", expanded=False):
                        for i, row in df.iterrows():
                            label = row['Option']
                            votes = row['Votes']
                            percentage = row['Percentage']
                            voter_ids = row['VoterIDs']
                            
                            # Create a nice card for each option
                            st.markdown(f"""
                            <div style="padding: 0.75rem; border-radius: 0.5rem; background-color: #f8f9fa; margin-bottom: 0.5rem; border-left: 4px solid {'#ff6b6b' if votes == max_votes else '#4ecdc4'};">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="font-weight: 600; font-size: 1rem;">{label}</div>
                                    <div style="font-weight: 500; color: #6c757d;">{votes} votes ({percentage:.1f}%)</div>
                                </div>
                            </div>
                            """, unsafe_allow_html=True)
                            
                            if voter_ids:
                                voter_ids_str = ", ".join([f"#{vid}" for vid in sorted(voter_ids)])
                                st.caption(f"Voters: {voter_ids_str}")
                            else:
                                st.caption("No votes")
                            
                            st.write("")
                
                elif config['type'] == 'private' and vote_count > 0:
                    # Private vote with decryption
                    can_decrypt = st.session_state.decryption_key is not None and len(st.session_state.decryption_key) > 0
                    
                    if can_decrypt:
                        # Try to decrypt votes
                        try:
                            with st.spinner("Decrypting votes..."):
                                # Fetch encrypted votes from contract
                                vote_data = contract.functions.getAllPrivateVotes(election_id).call()
                                user_ids = vote_data[0]
                                encrypted_sigs = vote_data[1]
                                
                                # Decrypt each vote
                                decrypted_votes = []
                                vote_counts = [0] * config['options']
                                voters_by_choice = {}
                                
                                for i, (user_id, encrypted_sig) in enumerate(zip(user_ids, encrypted_sigs)):
                                    try:
                                        # Get voter address from user ID
                                        voter_address = contract.functions.idToAddress(user_id).call()
                                        
                                        # Decrypt and verify vote
                                        result = decrypt_and_verify_vote(
                                            encrypted_sig,
                                            voter_address,
                                            st.session_state.decryption_key,
                                            PRIVATE_VOTE_OPTIONS[election_id]
                                        )
                                        
                                        if result['vote']:
                                            choice = result['vote']['choice']
                                            vote_counts[choice - 1] += 1
                                            
                                            if choice not in voters_by_choice:
                                                voters_by_choice[choice] = []
                                            voters_by_choice[choice].append(int(user_id))
                                            
                                            decrypted_votes.append({
                                                'user_id': int(user_id),
                                                'choice': choice,
                                                'option_text': result['vote']['optionText']
                                            })
                                    except Exception as e:
                                        st.warning(f"Could not decrypt vote from user #{user_id}: {str(e)}")
                                        continue
                                
                                # Display results similar to public votes
                                option_labels = []
                                if config['options'] == 4:
                                    if "District" in config['name'] or "Coordination" in config['name']:
                                        option_labels = ["District A", "District B", "District C", "District D"]
                                    else:
                                        option_labels = ["Option A", "Option B", "Option C", "Option D"]
                                else:
                                    option_labels = [f"Option {i+1}" for i in range(config['options'])]
                                
                                # Create results dataframe
                                df = pd.DataFrame({
                                    'Option': option_labels,
                                    'Votes': vote_counts,
                                    'VoterIDs': [voters_by_choice.get(i+1, []) for i in range(len(option_labels))]
                                })
                                
                                # Calculate percentages
                                df['Percentage'] = (df['Votes'] / vote_count * 100).round(1) if vote_count > 0 else 0
                                
                                # Find winner
                                max_votes = df['Votes'].max()
                                winners = df[df['Votes'] == max_votes]['Option'].tolist()
                                
                                # Create modern visualization with Plotly
                                col1, col2 = st.columns([2, 1])
                                
                                with col1:
                                    # Create horizontal bar chart with Plotly
                                    colors = ['#ff6b6b' if v == max_votes else '#a78bfa' for v in df['Votes']]
                                    
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
                                        title=dict(
                                            text=f"🔐 Decrypted Results: {config['name']}",
                                            font=dict(size=16, color='#333')
                                        ),
                                        xaxis_title="Number of Votes",
                                        yaxis_title="",
                                        height=max(300, len(option_labels) * 80),
                                        margin=dict(l=20, r=100, t=60, b=40),
                                        plot_bgcolor='rgba(0,0,0,0)',
                                        paper_bgcolor='rgba(0,0,0,0)',
                                        font=dict(size=12),
                                        xaxis=dict(
                                            showgrid=True,
                                            gridcolor='rgba(0,0,0,0.05)'
                                        ),
                                        yaxis=dict(
                                            showgrid=False,
                                            categoryorder='total ascending'
                                        )
                                    )
                                    
                                    st.plotly_chart(fig, use_container_width=True)
                                
                                with col2:
                                    # Winner announcement
                                    st.markdown("### 🏆 Result")
                                    if len(winners) == 1:
                                        st.success(f"**{winners[0]}**")
                                        st.metric("Winning Votes", max_votes)
                                        st.metric("Margin", f"{(df['Votes'].max() / vote_count * 100):.1f}%" if vote_count > 0 else "0%")
                                    else:
                                        st.info(f"**Tie**")
                                        st.write(f"{', '.join(winners)}")
                                        st.metric("Tied Votes", max_votes)
                                    
                                    st.divider()
                                    st.metric("Total Votes", vote_count)
                                    total_registered = contract.functions.getTotalRegistered().call()
                                    st.metric("Turnout Rate", f"{(vote_count / total_registered * 100):.1f}%" if vote_count > 0 and total_registered > 0 else "0%")
                                
                                # Voter details hidden behind a non-obvious element
                                # Use a subtle "..." button or small text
                                st.write("")  # spacing
                                if st.button("⋯", key=f"reveal_private_{election_id}", help="Show detailed voter breakdown"):
                                    st.session_state[f"show_private_details_{election_id}"] = not st.session_state.get(f"show_private_details_{election_id}", False)
                                
                                # Show details if button was clicked
                                if st.session_state.get(f"show_private_details_{election_id}", False):
                                    st.markdown("---")
                                    st.caption("🔓 **Decrypted Voter Breakdown**")
                                    
                                    for i, row in df.iterrows():
                                        label = row['Option']
                                        votes = row['Votes']
                                        percentage = row['Percentage']
                                        voter_ids = row['VoterIDs']
                                        
                                        # Create a nice card for each option
                                        st.markdown(f"""
                                        <div style="padding: 0.75rem; border-radius: 0.5rem; background-color: #f3f4f6; margin-bottom: 0.5rem; border-left: 4px solid {'#ff6b6b' if votes == max_votes else '#a78bfa'};">
                                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                                <div style="font-weight: 600; font-size: 1rem;">{label}</div>
                                                <div style="font-weight: 500; color: #6c757d;">{votes} votes ({percentage:.1f}%)</div>
                                            </div>
                                        </div>
                                        """, unsafe_allow_html=True)
                                        
                                        if voter_ids:
                                            voter_ids_str = ", ".join([f"#{vid}" for vid in sorted(voter_ids)])
                                            st.caption(f"Voters: {voter_ids_str}")
                                        else:
                                            st.caption("No votes")
                                        
                                        st.write("")
                        
                        except Exception as e:
                            st.error(f"Error decrypting votes: {str(e)}")
                            # Fall back to showing encrypted state
                            col1, col2 = st.columns([2, 1])
                            
                            with col1:
                                st.markdown("""
                                <div style="padding: 2rem; border-radius: 0.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
                                    <div style="font-size: 3rem; margin-bottom: 1rem;">🔐</div>
                                    <div style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem;">Private Election</div>
                                    <div style="font-size: 0.9rem; opacity: 0.9;">Decryption failed - check your key</div>
                                </div>
                                """, unsafe_allow_html=True)
                            
                            with col2:
                                st.metric("Encrypted Votes", vote_count)
                                st.metric("Status", "Sealed" if status == "Closed" else "Open")
                                st.caption("Decryption key required")
                    
                    else:
                        # No decryption key provided
                        col1, col2 = st.columns([2, 1])
                        
                        with col1:
                            st.markdown("""
                            <div style="padding: 2rem; border-radius: 0.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center;">
                                <div style="font-size: 3rem; margin-bottom: 1rem;">🔐</div>
                                <div style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem;">Private Election</div>
                                <div style="font-size: 0.9rem; opacity: 0.9;">Results are encrypted and require decryption key</div>
                            </div>
                            """, unsafe_allow_html=True)
                        
                        with col2:
                            st.metric("Encrypted Votes", vote_count)
                            st.metric("Status", "Sealed" if status == "Closed" else "Open")
                            if status == "Closed":
                                st.info("💡 Decryption key required")
                
                elif vote_count == 0:
                    st.info("🗳️ No votes cast yet for this election")
    
    with tab2:
        st.subheader("Create New Custom Election")
        st.info("This section allows you to create elections beyond the predefined workshop elections.")
        
        new_election_public = st.checkbox("Public Election", value=True)
        
        if st.button("Create New Election"):
            if open_election(0, new_election_public):
                st.rerun()

else:
    # Welcome screen
    st.info("👈 Please connect using the sidebar to get started")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("""
        ### 🗳️ Voting Workshop Dashboard
        
        This dashboard allows you to:
        - 📊 View registration statistics
        - 🗳️ Open and close elections
        - 📈 View voting results in real-time
        - 🔐 Manage both public and private votes
        
        **To get started:**
        1. Enter your RPC URL
        2. Enter your wallet private key (contract owner only)
        3. Click "Connect"
        
        **Private Vote Decryption:** Enabled by default for private elections.
        
        **Security Note:** Keys are only stored in memory during your session.
        """)
    
    with col2:
        st.markdown("""
        ### 📋 Configured Elections
        """)
        
        for election_id, config in VOTE_CONFIGS.items():
            type_icon = "👁️" if config['type'] == 'public' else "🔐"
            st.write(f"{type_icon} **{election_id}.** {config['name']}")
    
    st.divider()
    
    st.caption(f"Contract: {CONTRACT_ADDRESS} | Network: Base Sepolia (Chain ID: 84532)")

