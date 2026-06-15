"""
Streamlit Interactive Dashboard with Plotly
Demo: Ask the AI to convert this to TypeScript/CSS/HTML.
"""
import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta

st.set_page_config(page_title="Interactive Dashboard", layout="wide")
st.title("📊 Interactive Dashboard Demo")
st.markdown("Built with **Streamlit + Plotly** — ask the AI to convert this to **TypeScript/CSS/HTML**!")

# ── Generate sample data ────────────────────────────────────────────────
np.random.seed(42)
dates = pd.date_range(start="2025-01-01", periods=60, freq="D")
categories = ["Revenue", "Costs", "Users", "Satisfaction"]

df = pd.DataFrame({
    "Date": dates,
    "Revenue": np.cumsum(np.random.randn(60) * 100 + 200),
    "Costs": np.cumsum(np.random.randn(60) * 30 + 100),
    "Users": np.random.poisson(50, 60).cumsum(),
    "Satisfaction": np.clip(np.random.normal(7.5, 1.0, 60), 0, 10),
})

products = pd.DataFrame({
    "Product": ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"],
    "Sales": np.random.randint(100, 500, 5),
    "Growth": np.random.uniform(-10, 30, 5),
    "Region": np.random.choice(["NA", "EU", "APAC", "LATAM"], 5),
})

# ── Sidebar ──────────────────────────────────────────────────────────────
st.sidebar.header("Controls")
metric = st.sidebar.selectbox("Main Metric", categories, index=0)
chart_type = st.sidebar.selectbox("Chart Type", ["Line", "Area", "Bar", "Scatter"])
show_ma = st.sidebar.checkbox("Show Moving Average", value=True)

# ── Row 1: KPI Cards ────────────────────────────────────────────────────
col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Total Revenue", f"${df['Revenue'].iloc[-1]:,.0f}",
              f"{df['Revenue'].iloc[-1] - df['Revenue'].iloc[0]:+,.0f}")
with col2:
    st.metric("Total Users", f"{df['Users'].iloc[-1]:,}",
              f"{df['Users'].iloc[-1] - df['Users'].iloc[0]:+,}")
with col3:
    avg_sat = df['Satisfaction'].mean()
    st.metric("Avg Satisfaction", f"{avg_sat:.1f}/10",
              f"{avg_sat - 7.5:+.1f}")
with col4:
    margin = (df['Revenue'] - df['Costs']).iloc[-1]
    st.metric("Profit Margin", f"${margin:,.0f}",
              f"{(margin / df['Revenue'].iloc[-1] * 100):+.1f}%")

# ── Row 2: Interactive Plotly Chart ─────────────────────────────────────
st.subheader(f"{metric} Over Time")

fig = go.Figure()
y_col = metric

if chart_type == "Line":
    fig.add_trace(go.Scatter(x=df["Date"], y=df[y_col], mode="lines+markers",
                             name=metric, line=dict(width=3)))
elif chart_type == "Area":
    fig.add_trace(go.Scatter(x=df["Date"], y=df[y_col], fill="tozeroy",
                             mode="lines", name=metric, line=dict(width=2)))
elif chart_type == "Bar":
    fig.add_trace(go.Bar(x=df["Date"], y=df[y_col], name=metric))
elif chart_type == "Scatter":
    fig.add_trace(go.Scatter(x=df["Date"], y=df[y_col], mode="markers",
                             marker=dict(size=8, color=df[y_col], colorscale="Viridis",
                                         showscale=True), name=metric))

if show_ma and chart_type in ("Line", "Scatter"):
    ma = df[y_col].rolling(7).mean()
    fig.add_trace(go.Scatter(x=df["Date"], y=ma, mode="lines",
                             name="7-day MA", line=dict(dash="dash", color="orange")))

fig.update_layout(hovermode="x unified", height=450,
                  xaxis_title="Date", yaxis_title=metric,
                  margin=dict(l=20, r=20, t=20, b=20))
st.plotly_chart(fig, use_container_width=True)

# ── Row 3: Two columns ──────────────────────────────────────────────────
col_left, col_right = st.columns(2)

with col_left:
    st.subheader("Product Performance")
    fig2 = px.scatter(products, x="Sales", y="Growth", size="Sales",
                      color="Region", hover_name="Product",
                      text="Product", size_max=60)
    fig2.update_traces(textposition="top center")
    fig2.update_layout(height=400, margin=dict(l=20, r=20, t=10, b=20))
    st.plotly_chart(fig2, use_container_width=True)

with col_right:
    st.subheader("Distribution")
    fig3 = px.histogram(df, x="Satisfaction", nbins=15,
                        color_discrete_sequence=["#636efa"],
                        marginal="box")
    fig3.update_layout(height=400, margin=dict(l=20, r=20, t=10, b=20))
    st.plotly_chart(fig3, use_container_width=True)

# ── Row 4: Raw Data ─────────────────────────────────────────────────────
with st.expander("📄 View Raw Data"):
    st.dataframe(df, use_container_width=True)

st.markdown("---")
st.caption("Demo example — Ask the AI to convert this entire dashboard to TypeScript/CSS/HTML with React!")
