import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os

class PricePredictionModel:
    """Advanced price prediction using ensemble methods"""
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        
    def prepare_features(self, df):
        """Prepare time series features"""
        df = df.copy()
        df['Arrival_Date'] = pd.to_datetime(df['Arrival_Date'])
        df = df.sort_values('Arrival_Date')
        
        # Create time-based features
        df['day_of_week'] = df['Arrival_Date'].dt.dayofweek
        df['day_of_month'] = df['Arrival_Date'].dt.day
        df['month'] = df['Arrival_Date'].dt.month
        df['quarter'] = df['Arrival_Date'].dt.quarter
        
        # Create lag features
        df['price_lag_1'] = df['Modal_Price'].shift(1)
        df['price_lag_2'] = df['Modal_Price'].shift(2)
        df['price_lag_3'] = df['Modal_Price'].shift(3)
        
        # Rolling statistics
        df['price_rolling_mean_7'] = df['Modal_Price'].rolling(window=7, min_periods=1).mean()
        df['price_rolling_std_7'] = df['Modal_Price'].rolling(window=7, min_periods=1).std()
        
        # Drop NaN rows
        df = df.dropna()
        
        return df
    
    def predict(self, commodity_data, horizon=7):
        """
        Predict future prices
        
        Args:
            commodity_data: DataFrame with commodity price history
            horizon: Number of days ahead to predict
            
        Returns:
            dict with predictions and metrics
        """
        # Prepare features
        df = self.prepare_features(commodity_data)
        
        if len(df) < 20:
            return {
                'error': 'Insufficient data for training',
                'min_required': 20,
                'available': len(df)
            }
        
        # Define features
        feature_cols = [
            'day_of_week', 'day_of_month', 'month', 'quarter',
            'price_lag_1', 'price_lag_2', 'price_lag_3',
            'price_rolling_mean_7', 'price_rolling_std_7'
        ]
        
        X = df[feature_cols].values
        y = df['Modal_Price'].values
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, shuffle=False
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train ensemble model
        rf_model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
        gb_model = GradientBoostingRegressor(n_estimators=100, random_state=42, max_depth=5)
        
        rf_model.fit(X_train_scaled, y_train)
        gb_model.fit(X_train_scaled, y_train)
        
        # Ensemble predictions
        rf_pred = rf_model.predict(X_test_scaled)
        gb_pred = gb_model.predict(X_test_scaled)
        ensemble_pred = (rf_pred + gb_pred) / 2
        
        # Calculate metrics
        mae = mean_absolute_error(y_test, ensemble_pred)
        r2 = r2_score(y_test, ensemble_pred)
        
        # Predict future
        last_features = X[-1].reshape(1, -1)
        last_features_scaled = self.scaler.transform(last_features)
        
        rf_future = rf_model.predict(last_features_scaled)[0]
        gb_future = gb_model.predict(last_features_scaled)[0]
        predicted_price = (rf_future + gb_future) / 2
        
        # Calculate confidence interval (±10% based on MAE)
        confidence_range = mae * 1.5
        
        return {
            'predicted_price': float(predicted_price),
            'confidence_interval': {
                'lower': float(max(0, predicted_price - confidence_range)),
                'upper': float(predicted_price + confidence_range)
            },
            'model_metrics': {
                'mae': float(mae),
                'r2_score': float(r2),
                'accuracy': float(max(0, min(100, (1 - mae / y_test.mean()) * 100)))
            },
            'current_price': float(df['Modal_Price'].iloc[-1]),
            'price_change': float(predicted_price - df['Modal_Price'].iloc[-1]),
            'price_change_percent': float((predicted_price - df['Modal_Price'].iloc[-1]) / df['Modal_Price'].iloc[-1] * 100),
            'training_samples': len(X_train),
            'test_samples': len(X_test)
        }


class CropRecommendationModel:
    """Crop recommendation based on multiple factors"""
    
    def recommend(self, df, top_n=10):
        """
        Recommend best crops based on profitability metrics
        
        Args:
            df: DataFrame with market data
            top_n: Number of top recommendations
            
        Returns:
            list of recommended crops with scores
        """
        # Group by commodity
        commodity_stats = df.groupby('Commodity').agg({
            'Modal_Price': ['mean', 'std', 'min', 'max', 'count']
        }).reset_index()
        
        commodity_stats.columns = ['commodity', 'avg_price', 'price_std', 'min_price', 'max_price', 'market_count']
        
        # Calculate metrics
        commodity_stats['price_stability'] = 1 - (commodity_stats['price_std'] / commodity_stats['avg_price'])
        commodity_stats['price_stability'] = commodity_stats['price_stability'].clip(0, 1)
        
        commodity_stats['market_availability'] = commodity_stats['market_count'] / commodity_stats['market_count'].max()
        
        commodity_stats['profit_potential'] = commodity_stats['avg_price'] / commodity_stats['avg_price'].max()
        
        # Calculate overall score (weighted)
        commodity_stats['score'] = (
            commodity_stats['profit_potential'] * 0.4 +
            commodity_stats['price_stability'] * 0.3 +
            commodity_stats['market_availability'] * 0.3
        ) * 100
        
        # Sort by score
        commodity_stats = commodity_stats.sort_values('score', ascending=False)
        
        # Add recommendation reason
        def get_reason(row):
            if row['score'] >= 70:
                return 'Excellent choice: High prices, stable market, good availability'
            elif row['score'] >= 50:
                return 'Good option: Balanced price and market conditions'
            elif row['score'] >= 30:
                return 'Moderate choice: Consider market risks'
            else:
                return 'Risky option: Low prices or unstable market'
        
        commodity_stats['reason'] = commodity_stats.apply(get_reason, axis=1)
        
        # Select top N
        top_crops = commodity_stats.head(top_n)
        
        # Convert to dict
        recommendations = []
        for _, row in top_crops.iterrows():
            recommendations.append({
                'commodity': row['commodity'],
                'score': float(row['score']),
                'avg_price': float(row['avg_price']),
                'price_stability': float(row['price_stability'] * 100),
                'market_availability': float(row['market_availability'] * 100),
                'profit_potential': float(row['profit_potential'] * 100),
                'market_count': int(row['market_count']),
                'price_range': {
                    'min': float(row['min_price']),
                    'max': float(row['max_price'])
                },
                'reason': row['reason']
            })
        
        return recommendations


class YieldPredictionModel:
    """Yield prediction based on inputs and historical data"""
    
    # Base yields per acre (quintals) for common crops
    BASE_YIELDS = {
        'Rice': 25, 'Wheat': 30, 'Potato': 200, 'Onion': 150,
        'Tomato': 180, 'Cotton': 15, 'Sugarcane': 350, 'Maize': 28,
        'Soybean': 12, 'Groundnut': 15, 'Bajra': 10, 'Jowar': 12,
        'Tur': 8, 'Gram': 10, 'Mustard': 12, 'Sunflower': 10
    }
    
    def predict(self, commodity, land_size, fertilizer, irrigation, labor, historical_data=None):
        """
        Predict crop yield
        
        Args:
            commodity: Crop name
            land_size: Land size in acres
            fertilizer: Fertilizer cost
            irrigation: Irrigation cost
            labor: Labor cost
            historical_data: Historical price data for the commodity
            
        Returns:
            dict with yield predictions
        """
        # Get base yield
        base_yield = self.BASE_YIELDS.get(commodity, 20)
        
        # Calculate efficiency factors
        # Normalize inputs (assuming optimal values)
        fertilizer_factor = min(fertilizer / 10000, 1.5) if fertilizer > 0 else 0.5
        irrigation_factor = min(irrigation / 5000, 1.3) if irrigation > 0 else 0.6
        labor_factor = min(labor / 15000, 1.2) if labor > 0 else 0.7
        
        # Combined efficiency
        efficiency = (fertilizer_factor + irrigation_factor + labor_factor) / 3
        
        # Calculate expected yield
        expected_yield = base_yield * land_size * efficiency
        
        # Add regional factor if historical data available
        if historical_data is not None and len(historical_data) > 0:
            # Higher prices might indicate better quality/yield potential
            avg_price = historical_data['Modal_Price'].mean()
            max_price = historical_data['Modal_Price'].max()
            regional_factor = 0.9 + (avg_price / max_price) * 0.2
            expected_yield *= regional_factor
        
        # Calculate variance (±20%)
        variance = expected_yield * 0.2
        min_yield = max(0, expected_yield - variance)
        max_yield = expected_yield + variance
        
        # Confidence based on input completeness
        input_score = sum([
            1 if fertilizer > 0 else 0,
            1 if irrigation > 0 else 0,
            1 if labor > 0 else 0
        ])
        confidence = (input_score / 3) * 100
        
        # Calculate potential revenue if historical data available
        revenue_estimate = None
        if historical_data is not None and len(historical_data) > 0:
            avg_price = historical_data['Modal_Price'].mean()
            revenue_estimate = {
                'min_revenue': float(min_yield * avg_price),
                'expected_revenue': float(expected_yield * avg_price),
                'max_revenue': float(max_yield * avg_price),
                'avg_market_price': float(avg_price)
            }
        
        result = {
            'commodity': commodity,
            'land_size_acres': land_size,
            'expected_yield_quintals': float(round(expected_yield, 1)),
            'min_yield_quintals': float(round(min_yield, 1)),
            'max_yield_quintals': float(round(max_yield, 1)),
            'confidence_percent': float(round(confidence)),
            'efficiency_score': float(round(efficiency * 100, 1)),
            'factors': {
                'fertilizer_efficiency': float(round(fertilizer_factor * 100, 1)),
                'irrigation_efficiency': float(round(irrigation_factor * 100, 1)),
                'labor_efficiency': float(round(labor_factor * 100, 1))
            }
        }
        
        if revenue_estimate:
            result['revenue_estimate'] = revenue_estimate
        
        return result


class DemandForecastModel:
    """Demand forecasting based on price trends"""
    
    def forecast(self, commodity_data):
        """
        Forecast demand based on price patterns
        
        Args:
            commodity_data: DataFrame with commodity price history
            
        Returns:
            dict with demand forecast
        """
        if len(commodity_data) == 0:
            return {'error': 'No data available'}
        
        prices = commodity_data['Modal_Price'].values
        avg_price = np.mean(prices)
        max_price = np.max(prices)
        min_price = np.min(prices)
        std_price = np.std(prices)
        
        # Determine current demand based on price level
        if avg_price > max_price * 0.7:
            current_demand = 'high'
        elif avg_price > max_price * 0.4:
            current_demand = 'medium'
        else:
            current_demand = 'low'
        
        # Analyze trend
        volatility = std_price / avg_price if avg_price > 0 else 0
        
        if volatility > 0.5:
            trend = 'increasing'
            trend_direction = 'up'
        elif volatility < 0.2:
            trend = 'stable'
            trend_direction = 'stable'
        else:
            trend = 'decreasing'
            trend_direction = 'down'
        
        # Forecast price
        trend_multiplier = 1.05 if trend == 'increasing' else 0.95 if trend == 'decreasing' else 1.0
        forecasted_price = avg_price * trend_multiplier
        
        # Confidence
        confidence = min((len(commodity_data) / 100) * 100, 95)
        
        # Generate recommendation
        if current_demand == 'high' and trend == 'increasing':
            recommendation = 'Excellent time to sell! High demand and rising prices.'
        elif current_demand == 'high' and trend == 'stable':
            recommendation = 'Good market conditions. Consider selling soon.'
        elif current_demand == 'medium':
            recommendation = 'Moderate market. Monitor prices before selling.'
        else:
            recommendation = 'Low demand. Consider storing or waiting for better prices.'
        
        # Market strength score
        demand_score = {'high': 90, 'medium': 60, 'low': 30}[current_demand]
        trend_score = {'increasing': 90, 'stable': 60, 'decreasing': 30}[trend]
        market_strength = (demand_score + trend_score) / 2
        
        return {
            'commodity': commodity_data['Commodity'].iloc[0],
            'current_demand': current_demand,
            'trend': trend,
            'trend_direction': trend_direction,
            'forecasted_price': float(round(forecasted_price)),
            'current_avg_price': float(round(avg_price)),
            'price_range': {
                'min': float(min_price),
                'max': float(max_price),
                'std': float(round(std_price, 2))
            },
            'volatility': float(round(volatility, 3)),
            'confidence_percent': float(round(confidence)),
            'market_strength': float(round(market_strength, 1)),
            'recommendation': recommendation,
            'data_points': len(commodity_data)
        }