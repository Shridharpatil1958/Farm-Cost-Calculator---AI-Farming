"""
Script to train and save ML models offline for better performance
"""

import pandas as pd
import numpy as np
from ml_models import (
    PricePredictionModel,
    CropRecommendationModel,
    YieldPredictionModel,
    DemandForecastModel
)
import joblib
import os
from datetime import datetime

def train_all_models():
    """Train models for all commodities and save them"""
    
    print("🚀 Starting model training pipeline...")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Load data
    DATA_PATH = '../app/frontend/public/agmarknet-data.csv'
    print(f"📊 Loading data from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH)
    print(f"✅ Loaded {len(df)} records\n")
    
    # Get unique commodities
    commodities = df['Commodity'].unique()
    print(f"🌾 Found {len(commodities)} unique commodities\n")
    
    # Create models directory
    os.makedirs('models', exist_ok=True)
    
    # Initialize models
    price_model = PricePredictionModel()
    
    # Train price prediction models for each commodity
    print("=" * 60)
    print("TRAINING PRICE PREDICTION MODELS")
    print("=" * 60)
    
    results = []
    for i, commodity in enumerate(commodities, 1):
        print(f"\n[{i}/{len(commodities)}] Training model for: {commodity}")
        
        commodity_data = df[df['Commodity'] == commodity]
        print(f"  📈 Data points: {len(commodity_data)}")
        
        if len(commodity_data) < 20:
            print(f"  ⚠️  Skipping - insufficient data (need 20+)")
            continue
        
        try:
            result = price_model.predict(commodity_data, horizon=7)
            
            if 'error' not in result:
                # Save model
                model_path = f"models/price_model_{commodity.replace(' ', '_')}.pkl"
                joblib.dump(price_model, model_path)
                
                print(f"  ✅ Model trained successfully")
                print(f"  📊 Accuracy: {result['model_metrics']['accuracy']:.2f}%")
                print(f"  💾 Saved to: {model_path}")
                
                results.append({
                    'commodity': commodity,
                    'accuracy': result['model_metrics']['accuracy'],
                    'mae': result['model_metrics']['mae'],
                    'r2_score': result['model_metrics']['r2_score']
                })
            else:
                print(f"  ❌ Error: {result['error']}")
        
        except Exception as e:
            print(f"  ❌ Error training model: {str(e)}")
    
    # Summary
    print("\n" + "=" * 60)
    print("TRAINING SUMMARY")
    print("=" * 60)
    print(f"\n✅ Successfully trained {len(results)} models")
    
    if results:
        results_df = pd.DataFrame(results)
        print(f"\n📊 Average Accuracy: {results_df['accuracy'].mean():.2f}%")
        print(f"📊 Average MAE: {results_df['mae'].mean():.2f}")
        print(f"📊 Average R² Score: {results_df['r2_score'].mean():.3f}")
        
        # Top 5 best models
        print("\n🏆 Top 5 Most Accurate Models:")
        top_5 = results_df.nlargest(5, 'accuracy')
        for idx, row in top_5.iterrows():
            print(f"  {row['commodity']}: {row['accuracy']:.2f}%")
        
        # Save summary
        results_df.to_csv('models/training_summary.csv', index=False)
        print(f"\n💾 Training summary saved to: models/training_summary.csv")
    
    print(f"\n⏰ Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("✨ Training pipeline finished!\n")

def test_models():
    """Test trained models with sample predictions"""
    
    print("\n" + "=" * 60)
    print("TESTING TRAINED MODELS")
    print("=" * 60)
    
    # Load data
    DATA_PATH = '../app/frontend/public/agmarknet-data.csv'
    df = pd.read_csv(DATA_PATH)
    
    # Test a few commodities
    test_commodities = ['Rice', 'Wheat', 'Potato', 'Onion', 'Tomato']
    
    for commodity in test_commodities:
        model_path = f"models/price_model_{commodity.replace(' ', '_')}.pkl"
        
        if not os.path.exists(model_path):
            print(f"\n⚠️  Model not found for {commodity}")
            continue
        
        print(f"\n🧪 Testing {commodity} model...")
        
        try:
            # Load model
            model = joblib.load(model_path)
            
            # Get data
            commodity_data = df[df['Commodity'] == commodity]
            
            # Predict
            result = model.predict(commodity_data, horizon=7)
            
            print(f"  Current Price: ₹{result['current_price']:.2f}")
            print(f"  Predicted Price: ₹{result['predicted_price']:.2f}")
            print(f"  Change: {result['price_change_percent']:+.2f}%")
            print(f"  Confidence: {result['confidence_interval']['lower']:.2f} - {result['confidence_interval']['upper']:.2f}")
            print(f"  Accuracy: {result['model_metrics']['accuracy']:.2f}%")
            
        except Exception as e:
            print(f"  ❌ Error: {str(e)}")
    
    print("\n✨ Testing complete!\n")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'test':
        test_models()
    else:
        train_all_models()
        test_models()