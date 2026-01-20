from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from ml_models import (
    PricePredictionModel,
    CropRecommendationModel,
    YieldPredictionModel,
    DemandForecastModel
)
import os

app = Flask(__name__)
CORS(app)

# Load data
DATA_PATH = '../app/frontend/public/agmarknet-data.csv'
df = pd.read_csv(DATA_PATH)

# Initialize models
price_model = PricePredictionModel()
crop_model = CropRecommendationModel()
yield_model = YieldPredictionModel()
demand_model = DemandForecastModel()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Farm Cost Calculator API is running',
        'total_records': len(df),
        'commodities': df['Commodity'].nunique(),
        'states': df['State'].nunique()
    })

@app.route('/api/data/summary', methods=['GET'])
def get_data_summary():
    """Get summary statistics of the dataset"""
    summary = {
        'total_records': len(df),
        'commodities': df['Commodity'].nunique(),
        'states': df['State'].nunique(),
        'districts': df['District'].nunique(),
        'markets': df['Market'].nunique(),
        'avg_modal_price': float(df['Modal_Price'].mean()),
        'max_modal_price': float(df['Modal_Price'].max()),
        'min_modal_price': float(df['Modal_Price'].min()),
        'date_range': {
            'start': df['Arrival_Date'].min(),
            'end': df['Arrival_Date'].max()
        }
    }
    return jsonify(summary)

@app.route('/api/data/commodities', methods=['GET'])
def get_commodities():
    """Get list of all commodities"""
    commodities = sorted(df['Commodity'].unique().tolist())
    return jsonify({'commodities': commodities})

@app.route('/api/data/states', methods=['GET'])
def get_states():
    """Get list of all states"""
    states = sorted(df['State'].unique().tolist())
    return jsonify({'states': states})

@app.route('/api/predict/price', methods=['POST'])
def predict_price():
    """
    Predict future price for a commodity
    Request body: {
        "commodity": "Rice",
        "state": "Punjab" (optional),
        "horizon": 7 (days ahead, default 7)
    }
    """
    try:
        data = request.json
        commodity = data.get('commodity')
        state = data.get('state')
        horizon = data.get('horizon', 7)
        
        if not commodity:
            return jsonify({'error': 'Commodity is required'}), 400
        
        # Filter data
        commodity_data = df[df['Commodity'] == commodity].copy()
        if state:
            commodity_data = commodity_data[commodity_data['State'] == state]
        
        if len(commodity_data) < 10:
            return jsonify({'error': 'Insufficient data for prediction'}), 400
        
        # Train and predict
        result = price_model.predict(commodity_data, horizon)
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/recommend/crops', methods=['POST'])
def recommend_crops():
    """
    Recommend best crops based on profitability
    Request body: {
        "state": "Punjab" (optional),
        "top_n": 10
    }
    """
    try:
        data = request.json
        state = data.get('state')
        top_n = data.get('top_n', 10)
        
        # Filter data
        filtered_df = df if not state else df[df['State'] == state]
        
        # Get recommendations
        recommendations = crop_model.recommend(filtered_df, top_n)
        
        return jsonify({'recommendations': recommendations})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/predict/yield', methods=['POST'])
def predict_yield():
    """
    Predict crop yield
    Request body: {
        "commodity": "Rice",
        "land_size": 5.0,
        "fertilizer_cost": 15000,
        "irrigation_cost": 8000,
        "labor_cost": 20000,
        "state": "Punjab" (optional)
    }
    """
    try:
        data = request.json
        commodity = data.get('commodity')
        land_size = data.get('land_size')
        fertilizer = data.get('fertilizer_cost', 0)
        irrigation = data.get('irrigation_cost', 0)
        labor = data.get('labor_cost', 0)
        state = data.get('state')
        
        if not commodity or not land_size:
            return jsonify({'error': 'Commodity and land_size are required'}), 400
        
        # Get historical data for the commodity
        commodity_data = df[df['Commodity'] == commodity].copy()
        if state:
            commodity_data = commodity_data[commodity_data['State'] == state]
        
        # Predict yield
        result = yield_model.predict(
            commodity=commodity,
            land_size=land_size,
            fertilizer=fertilizer,
            irrigation=irrigation,
            labor=labor,
            historical_data=commodity_data
        )
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/forecast/demand', methods=['POST'])
def forecast_demand():
    """
    Forecast demand for a commodity
    Request body: {
        "commodity": "Rice",
        "state": "Punjab" (optional)
    }
    """
    try:
        data = request.json
        commodity = data.get('commodity')
        state = data.get('state')
        
        if not commodity:
            return jsonify({'error': 'Commodity is required'}), 400
        
        # Filter data
        commodity_data = df[df['Commodity'] == commodity].copy()
        if state:
            commodity_data = commodity_data[commodity_data['State'] == state]
        
        if len(commodity_data) < 5:
            return jsonify({'error': 'Insufficient data for forecasting'}), 400
        
        # Forecast demand
        result = demand_model.forecast(commodity_data)
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze/profitability', methods=['POST'])
def analyze_profitability():
    """
    Analyze profitability for a crop
    Request body: {
        "commodity": "Rice",
        "state": "Punjab",
        "total_cost": 50000,
        "expected_yield": 100
    }
    """
    try:
        data = request.json
        commodity = data.get('commodity')
        state = data.get('state')
        total_cost = data.get('total_cost')
        expected_yield = data.get('expected_yield')
        
        if not all([commodity, total_cost, expected_yield]):
            return jsonify({'error': 'commodity, total_cost, and expected_yield are required'}), 400
        
        # Get current market prices
        commodity_data = df[df['Commodity'] == commodity].copy()
        if state:
            commodity_data = commodity_data[commodity_data['State'] == state]
        
        if len(commodity_data) == 0:
            return jsonify({'error': 'No market data available'}), 400
        
        # Calculate profitability scenarios
        prices = commodity_data['Modal_Price'].values
        avg_price = np.mean(prices)
        max_price = np.max(prices)
        min_price = np.min(prices)
        
        scenarios = {
            'best_case': {
                'price_per_quintal': float(max_price),
                'total_revenue': float(max_price * expected_yield),
                'profit': float(max_price * expected_yield - total_cost),
                'roi': float((max_price * expected_yield - total_cost) / total_cost * 100)
            },
            'average_case': {
                'price_per_quintal': float(avg_price),
                'total_revenue': float(avg_price * expected_yield),
                'profit': float(avg_price * expected_yield - total_cost),
                'roi': float((avg_price * expected_yield - total_cost) / total_cost * 100)
            },
            'worst_case': {
                'price_per_quintal': float(min_price),
                'total_revenue': float(min_price * expected_yield),
                'profit': float(min_price * expected_yield - total_cost),
                'roi': float((min_price * expected_yield - total_cost) / total_cost * 100)
            },
            'break_even_price': float(total_cost / expected_yield)
        }
        
        return jsonify(scenarios)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/compare/prices', methods=['POST'])
def compare_prices():
    """
    Compare prices across states/markets
    Request body: {
        "commodity": "Rice",
        "comparison_type": "state" or "market"
    }
    """
    try:
        data = request.json
        commodity = data.get('commodity')
        comparison_type = data.get('comparison_type', 'state')
        
        if not commodity:
            return jsonify({'error': 'Commodity is required'}), 400
        
        # Filter data
        commodity_data = df[df['Commodity'] == commodity].copy()
        
        if len(commodity_data) == 0:
            return jsonify({'error': 'No data available for this commodity'}), 400
        
        # Group by comparison type
        if comparison_type == 'state':
            grouped = commodity_data.groupby('State')['Modal_Price'].agg(['mean', 'min', 'max', 'count']).reset_index()
            grouped.columns = ['location', 'avg_price', 'min_price', 'max_price', 'market_count']
        else:
            grouped = commodity_data.groupby('Market')['Modal_Price'].agg(['mean', 'min', 'max', 'count']).reset_index()
            grouped.columns = ['location', 'avg_price', 'min_price', 'max_price', 'entry_count']
        
        # Sort by average price
        grouped = grouped.sort_values('avg_price', ascending=False)
        
        # Convert to dict
        comparison = grouped.to_dict('records')
        
        # Add best and worst
        result = {
            'comparison': comparison,
            'best_location': comparison[0]['location'] if len(comparison) > 0 else None,
            'worst_location': comparison[-1]['location'] if len(comparison) > 0 else None,
            'price_range': {
                'highest': float(grouped['avg_price'].max()),
                'lowest': float(grouped['avg_price'].min()),
                'difference': float(grouped['avg_price'].max() - grouped['avg_price'].min())
            }
        }
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Farm Cost Calculator API...")
    print(f"📊 Loaded {len(df)} market records")
    print(f"🌾 Commodities: {df['Commodity'].nunique()}")
    print(f"📍 States: {df['State'].nunique()}")
    print("\n🔗 API Endpoints:")
    print("  GET  /api/health - Health check")
    print("  GET  /api/data/summary - Data summary")
    print("  GET  /api/data/commodities - List commodities")
    print("  GET  /api/data/states - List states")
    print("  POST /api/predict/price - Price prediction")
    print("  POST /api/recommend/crops - Crop recommendations")
    print("  POST /api/predict/yield - Yield prediction")
    print("  POST /api/forecast/demand - Demand forecast")
    print("  POST /api/analyze/profitability - Profitability analysis")
    print("  POST /api/compare/prices - Price comparison")
    print("\n✅ Server running on http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000)