"""
Voting Workshop Backup Dashboard
A backup Streamlit application for the voting workshop.
"""

import streamlit as st
import json
from web3 import Web3
from eth_account import Account
import pandas as pd
import plotly.graph_objects as go
import time
from datetime import datetime

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
CONTRACT_ADDRESS = "0x0918E5b67187400548571D372D381C4bB4B9B27b"

# Default RPC endpoint
DEFAULT_RPC_URL = "https://public.sepolia.rpc.status.network"

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
    
    if st.button("🔌 Connect", type="primary", use_container_width=False):
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
        if st.button("🔄 Refresh", use_container_width=True):
            st.session_state.last_refresh = datetime.now()
            st.rerun()
    
    st.divider()
    
    # Main content area
    st.header("📊 Election Information")
    
    # Election ID input
    col_input1, col_input2, col_input3 = st.columns([2, 2, 1])
    
    with col_input1:
        election_id = st.number_input(
            "Enter Election ID",
            min_value=0,
            step=1,
            value=0,
            key="election_id_input",
            help="Enter the election number/ID to view its information"
        )
    
    with col_input2:
        num_choices = st.number_input(
            "Number of Choices/Options",
            min_value=2,
            max_value=10,
            step=1,
            value=4,
            key="num_choices_input",
            help="How many options/choices does this election have?"
        )
    
    with col_input3:
        st.markdown("<br>", unsafe_allow_html=True)  # Spacer for alignment
        get_info_button = st.button("🔍 Get Info", type="primary", use_container_width=True)
    
    # Always show results area
    results_container = st.container()
    
    with results_container:
        if get_info_button:
            # Store the query in session state
            st.session_state.current_election_id = election_id
            st.session_state.current_num_choices = num_choices
            st.session_state.show_results = True
        
        # Display results if we have queried before
        if st.session_state.get('show_results', False):
            query_election_id = st.session_state.get('current_election_id', 0)
            query_num_choices = st.session_state.get('current_num_choices', 4)
            
            try:
                contract = st.session_state.contract
                
                # Get election details
                with st.spinner("Fetching election data..."):
                    election = contract.functions.getElection(query_election_id).call()
                    vote_count = contract.functions.getVoteCount(query_election_id).call()
                    is_public = election[2]  # Index 2 is isPublic
                
                # Display election information
                st.success(f"✅ Election #{query_election_id} found!")
                
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
                        
                        # Create option labels
                        option_labels = [f"Option {i+1}" for i in range(query_num_choices)]
                        
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
                            
                            st.plotly_chart(fig, use_container_width=True)
                        
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
                        # Create votes dataframe
                        votes_df = pd.DataFrame({
                            'User ID': [int(uid) for uid in user_ids],
                            'Choice': [f"Option {int(choice)}" for choice in choices]
                        })
                        
                        # Sort by User ID for better readability
                        votes_df = votes_df.sort_values('User ID').reset_index(drop=True)
                        
                        # Display table
                        st.dataframe(
                            votes_df,
                            use_container_width=True,
                            hide_index=True,
                            height=min(400, 50 + len(votes_df) * 35)
                        )
                        
                        st.caption(f"Total: {len(votes_df)} votes")
                    else:
                        st.info("No votes recorded yet.")
            
            except Exception as e:
                if "execution reverted" in str(e).lower() or "invalid election" in str(e).lower():
                    st.error(f"❌ Election #{query_election_id} does not exist or is invalid.")
                else:
                    st.error(f"❌ Error fetching election data: {str(e)}")

