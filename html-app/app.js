// Global variables
let marketData = [];
let filteredData = [];
const API_BASE_URL = 'http://localhost:5000/api';

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEventListeners();
    hideLoading();
});

// Load CSV data
async function loadData() {
    try {
        const response = await fetch('agmarknet-data.csv');
        const csvText = await response.text();
        marketData = parseCSV(csvText);
        filteredData = [...marketData];
        
        // Populate UI
        populateStats();
        populateTopCommodities();
        populateFilters();
        populateTable();
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load market data. Please make sure you are running a local server (e.g., python3 -m http.server 8000)');
    }
}

// Parse CSV
function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = values[i];
        });
        return {
            state: obj['State'] || '',
            district: obj['District'] || '',
            market: obj['Market'] || '',
            commodity: obj['Commodity'] || '',
            variety: obj['Variety'] || '',
            arrivalDate: obj['Arrival_Date'] || '',
            minPrice: parseFloat(obj['Min_Price']) || 0,
            maxPrice: parseFloat(obj['Max_Price']) || 0,
            modalPrice: parseFloat(obj['Modal_Price']) || 0
        };
    });
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            navigateTo(page);
        });
    });
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Calculator form
    document.getElementById('calculatorForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        calculateCosts();
    });
    
    // Analysis form
    document.getElementById('analysisForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        analyzeProfitability();
    });
    
    // Yield form
    document.getElementById('yieldForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        predictYield();
    });
}

// Navigation
function navigateTo(page) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });
    
    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === page);
    });
}

// Tab switching
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });
}

// Populate stats
function populateStats() {
    const commodities = [...new Set(marketData.map(d => d.commodity))].length;
    const states = [...new Set(marketData.map(d => d.state))].length;
    const avgPrice = marketData.reduce((sum, d) => sum + d.modalPrice, 0) / marketData.length;
    
    const statsHTML = `
        <div class="stat-card">
            <div class="icon">📦</div>
            <h3>Total Commodities</h3>
            <div class="value">${commodities}</div>
            <p>Different crops tracked</p>
        </div>
        <div class="stat-card">
            <div class="icon">📍</div>
            <h3>States Covered</h3>
            <div class="value">${states}</div>
            <p>Across India</p>
        </div>
        <div class="stat-card">
            <div class="icon">📊</div>
            <h3>Market Records</h3>
            <div class="value">${marketData.length.toLocaleString()}</div>
            <p>Price entries</p>
        </div>
        <div class="stat-card">
            <div class="icon">₹</div>
            <h3>Average Price</h3>
            <div class="value">₹${Math.round(avgPrice)}</div>
            <p>Per quintal</p>
        </div>
    `;
    
    document.getElementById('statsGrid').innerHTML = statsHTML;
}

// Populate top commodities
function populateTopCommodities() {
    const commodityStats = {};
    
    marketData.forEach(item => {
        if (!commodityStats[item.commodity]) {
            commodityStats[item.commodity] = { total: 0, count: 0 };
        }
        commodityStats[item.commodity].total += item.modalPrice;
        commodityStats[item.commodity].count++;
    });
    
    const topCommodities = Object.entries(commodityStats)
        .map(([commodity, stats]) => ({
            commodity,
            avgPrice: stats.total / stats.count,
            count: stats.count
        }))
        .sort((a, b) => b.avgPrice - a.avgPrice)
        .slice(0, 5);
    
    const html = topCommodities.map((item, index) => `
        <div class="stat-card" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 40px; height: 40px; background: ${index === 0 ? '#FEF3C7' : index === 1 ? '#E5E7EB' : index === 2 ? '#FED7AA' : '#DCFCE7'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.25rem;">
                    ${index + 1}
                </div>
                <div>
                    <h3 style="font-size: 1.125rem; font-weight: 600; color: var(--text); margin-bottom: 0.25rem;">${item.commodity}</h3>
                    <p style="font-size: 0.875rem; color: var(--text-muted);">${item.count} market entries</p>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">₹${Math.round(item.avgPrice)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">avg. per quintal</div>
            </div>
        </div>
    `).join('');
    
    document.getElementById('topCommodities').innerHTML = html;
}

// Populate filters
function populateFilters() {
    const commodities = [...new Set(marketData.map(d => d.commodity))].sort();
    const states = [...new Set(marketData.map(d => d.state))].sort();
    
    // Populate all commodity selects
    const commoditySelects = [
        'commodityFilter', 'cropSelect', 'analysisCommodity', 
        'compareCommodity', 'predCommodity', 'yieldCrop', 'demandCommodity'
    ];
    
    commoditySelects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            commodities.forEach(c => {
                const option = document.createElement('option');
                option.value = c;
                option.textContent = c;
                select.appendChild(option);
            });
        }
    });
    
    // Populate state filters
    const stateSelects = ['stateFilter', 'recState'];
    stateSelects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            states.forEach(s => {
                const option = document.createElement('option');
                option.value = s;
                option.textContent = s;
                select.appendChild(option);
            });
        }
    });
}

// Apply filters
function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const state = document.getElementById('stateFilter').value;
    const commodity = document.getElementById('commodityFilter').value;
    
    filteredData = marketData.filter(item => {
        const matchesSearch = item.commodity.toLowerCase().includes(search) || 
                            item.market.toLowerCase().includes(search);
        const matchesState = !state || item.state === state;
        const matchesCommodity = !commodity || item.commodity === commodity;
        
        return matchesSearch && matchesState && matchesCommodity;
    });
    
    populateTable();
}

// Populate table
let currentPage = 1;
const rowsPerPage = 20;

function populateTable(page = 1) {
    currentPage = page;
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredData.slice(start, end);
    
    const tbody = document.getElementById('priceTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = pageData.map(item => `
        <tr>
            <td>${item.commodity}</td>
            <td>${item.state}</td>
            <td>${item.district}</td>
            <td>${item.market}</td>
            <td style="font-weight: 600; color: var(--primary);">₹${item.modalPrice}</td>
            <td>${item.arrivalDate}</td>
        </tr>
    `).join('');
    
    // Update pagination
    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const pagination = document.getElementById('pagination');
    if (pagination) {
        let paginationHTML = '';
        
        if (page > 1) {
            paginationHTML += `<button onclick="populateTable(${page - 1})">Previous</button>`;
        }
        
        for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
            paginationHTML += `<button class="${i === page ? 'active' : ''}" onclick="populateTable(${i})">${i}</button>`;
        }
        
        if (page < totalPages) {
            paginationHTML += `<button onclick="populateTable(${page + 1})">Next</button>`;
        }
        
        pagination.innerHTML = paginationHTML;
    }
}

// Sort table
let sortColumn = -1;
let sortAscending = true;

function sortTable(column) {
    if (sortColumn === column) {
        sortAscending = !sortAscending;
    } else {
        sortColumn = column;
        sortAscending = true;
    }
    
    const columns = ['commodity', 'state', 'district', 'market', 'modalPrice', 'arrivalDate'];
    const key = columns[column];
    
    filteredData.sort((a, b) => {
        let aVal = a[key];
        let bVal = b[key];
        
        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return sortAscending ? -1 : 1;
        if (aVal > bVal) return sortAscending ? 1 : -1;
        return 0;
    });
    
    populateTable(currentPage);
}

// Calculator
function calculateCosts() {
    const landSize = parseFloat(document.getElementById('landSize').value) || 0;
    const seeds = parseFloat(document.getElementById('seedsCost').value) || 0;
    const fertilizer = parseFloat(document.getElementById('fertilizerCost').value) || 0;
    const pesticide = parseFloat(document.getElementById('pesticideCost').value) || 0;
    const labor = parseFloat(document.getElementById('laborCost').value) || 0;
    const irrigation = parseFloat(document.getElementById('irrigationCost').value) || 0;
    const other = parseFloat(document.getElementById('otherCost').value) || 0;
    
    const total = seeds + fertilizer + pesticide + labor + irrigation + other;
    const perAcre = landSize > 0 ? total / landSize : 0;
    
    const resultHTML = `
        <div style="text-align: center; padding: 2rem;">
            <h3 style="color: var(--text-muted); margin-bottom: 1rem;">Total Investment</h3>
            <div style="font-size: 3rem; font-weight: 700; color: var(--primary); margin-bottom: 2rem;">
                ₹${total.toLocaleString()}
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; text-align: left; background: white; padding: 1.5rem; border-radius: 0.5rem;">
                <div>
                    <div style="color: var(--text-muted); font-size: 0.875rem;">Seeds</div>
                    <div style="font-weight: 600;">₹${seeds.toLocaleString()}</div>
                </div>
                <div>
                    <div style="color: var(--text-muted); font-size: 0.875rem;">Fertilizer</div>
                    <div style="font-weight: 600;">₹${fertilizer.toLocaleString()}</div>
                </div>
                <div>
                    <div style="color: var(--text-muted); font-size: 0.875rem;">Pesticide</div>
                    <div style="font-weight: 600;">₹${pesticide.toLocaleString()}</div>
                </div>
                <div>
                    <div style="color: var(--text-muted); font-size: 0.875rem;">Labor</div>
                    <div style="font-weight: 600;">₹${labor.toLocaleString()}</div>
                </div>
                <div>
                    <div style="color: var(--text-muted); font-size: 0.875rem;">Irrigation</div>
                    <div style="font-weight: 600;">₹${irrigation.toLocaleString()}</div>
                </div>
                <div>
                    <div style="color: var(--text-muted); font-size: 0.875rem;">Other</div>
                    <div style="font-weight: 600;">₹${other.toLocaleString()}</div>
                </div>
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1rem; background: white; border-radius: 0.5rem;">
                <div style="color: var(--text-muted); font-size: 0.875rem;">Cost per Acre</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">
                    ₹${Math.round(perAcre).toLocaleString()}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('calculatorResult').innerHTML = resultHTML;
}

// Profitability Analysis
function analyzeProfitability() {
    const commodity = document.getElementById('analysisCommodity').value;
    const investment = parseFloat(document.getElementById('totalInvestment').value) || 0;
    const yield_ = parseFloat(document.getElementById('expectedYield').value) || 0;
    
    if (!commodity || investment === 0 || yield_ === 0) {
        alert('Please fill all fields');
        return;
    }
    
    const commodityData = marketData.filter(d => d.commodity === commodity);
    if (commodityData.length === 0) {
        alert('No market data available for this commodity');
        return;
    }
    
    const prices = commodityData.map(d => d.modalPrice);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    
    const scenarios = [
        { name: 'Best Case', price: maxPrice, color: '#10B981' },
        { name: 'Average Case', price: avgPrice, color: '#F59E0B' },
        { name: 'Worst Case', price: minPrice, color: '#EF4444' }
    ];
    
    const resultHTML = scenarios.map(scenario => {
        const revenue = scenario.price * yield_;
        const profit = revenue - investment;
        const roi = (profit / investment) * 100;
        
        return `
            <div style="padding: 1.5rem; background: white; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid ${scenario.color};">
                <h3 style="color: ${scenario.color}; margin-bottom: 1rem;">${scenario.name}</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div>
                        <div style="color: var(--text-muted); font-size: 0.875rem;">Price/Quintal</div>
                        <div style="font-weight: 600;">₹${Math.round(scenario.price)}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-muted); font-size: 0.875rem;">Revenue</div>
                        <div style="font-weight: 600;">₹${Math.round(revenue).toLocaleString()}</div>
                    </div>
                    <div>
                        <div style="color: var(--text-muted); font-size: 0.875rem;">Profit</div>
                        <div style="font-weight: 600; color: ${profit >= 0 ? '#10B981' : '#EF4444'};">
                            ₹${Math.round(profit).toLocaleString()}
                        </div>
                    </div>
                    <div>
                        <div style="color: var(--text-muted); font-size: 0.875rem;">ROI</div>
                        <div style="font-weight: 600; color: ${roi >= 0 ? '#10B981' : '#EF4444'};">
                            ${roi.toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    const breakEven = investment / yield_;
    
    document.getElementById('analysisResult').innerHTML = resultHTML + `
        <div style="padding: 1.5rem; background: white; border-radius: 0.5rem; text-align: center;">
            <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Break-even Price</div>
            <div style="font-size: 2rem; font-weight: 700; color: var(--primary);">
                ₹${Math.round(breakEven)}/quintal
            </div>
        </div>
    `;
}

// Price Comparison
function comparePrice() {
    const commodity = document.getElementById('compareCommodity').value;
    
    if (!commodity) {
        alert('Please select a commodity');
        return;
    }
    
    const commodityData = marketData.filter(d => d.commodity === commodity);
    
    if (commodityData.length === 0) {
        alert('No data available for this commodity');
        return;
    }
    
    const stateStats = {};
    commodityData.forEach(item => {
        if (!stateStats[item.state]) {
            stateStats[item.state] = { total: 0, count: 0, prices: [] };
        }
        stateStats[item.state].total += item.modalPrice;
        stateStats[item.state].count++;
        stateStats[item.state].prices.push(item.modalPrice);
    });
    
    const comparison = Object.entries(stateStats)
        .map(([state, stats]) => ({
            state,
            avgPrice: stats.total / stats.count,
            minPrice: Math.min(...stats.prices),
            maxPrice: Math.max(...stats.prices),
            count: stats.count
        }))
        .sort((a, b) => b.avgPrice - a.avgPrice);
    
    const best = comparison.slice(0, 10);
    const worst = comparison.slice(-10).reverse();
    
    const resultHTML = `
        <div class="grid-2">
            <div class="card">
                <div class="card-header">
                    <h2>🏆 Top 10 Best Markets</h2>
                    <p>Highest average prices for ${commodity}</p>
                </div>
                <div class="card-body">
                    ${best.map((item, i) => `
                        <div style="display: flex; justify-content: space-between; padding: 1rem; background: ${i === 0 ? '#DCFCE7' : 'white'}; border-radius: 0.5rem; margin-bottom: 0.5rem;">
                            <div>
                                <div style="font-weight: 600;">${item.state}</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">${item.count} markets</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 700; color: var(--primary);">₹${Math.round(item.avgPrice)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">avg</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2>📉 Bottom 10 Markets</h2>
                    <p>Lowest average prices for ${commodity}</p>
                </div>
                <div class="card-body">
                    ${worst.map(item => `
                        <div style="display: flex; justify-content: space-between; padding: 1rem; background: white; border-radius: 0.5rem; margin-bottom: 0.5rem;">
                            <div>
                                <div style="font-weight: 600;">${item.state}</div>
                                <div style="font-size: 0.875rem; color: var(--text-muted);">${item.count} markets</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-weight: 700; color: #EF4444;">₹${Math.round(item.avgPrice)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">avg</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('compareResult').innerHTML = resultHTML;
}

// AI Features - Price Prediction
async function predictPrice() {
    const commodity = document.getElementById('predCommodity').value;
    
    if (!commodity) {
        alert('Please select a commodity');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE_URL}/predict/price`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commodity })
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        const resultHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Predicted Price (Next Period)</div>
                <div style="font-size: 4rem; font-weight: 700; color: var(--purple); margin-bottom: 1rem;">
                    ₹${Math.round(result.predicted_price)}
                </div>
                <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 2rem;">per quintal</div>
                
                <div style="background: white; padding: 1.5rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; text-align: left;">
                        <div>
                            <div style="color: var(--text-muted); font-size: 0.875rem;">Current Price</div>
                            <div style="font-weight: 600;">₹${Math.round(result.current_price)}</div>
                        </div>
                        <div>
                            <div style="color: var(--text-muted); font-size: 0.875rem;">Price Change</div>
                            <div style="font-weight: 600; color: ${result.price_change >= 0 ? '#10B981' : '#EF4444'};">
                                ${result.price_change >= 0 ? '+' : ''}${result.price_change_percent.toFixed(1)}%
                            </div>
                        </div>
                        <div>
                            <div style="color: var(--text-muted); font-size: 0.875rem;">Confidence Range</div>
                            <div style="font-weight: 600;">₹${Math.round(result.confidence_interval.lower)} - ₹${Math.round(result.confidence_interval.upper)}</div>
                        </div>
                        <div>
                            <div style="color: var(--text-muted); font-size: 0.875rem;">Model Accuracy</div>
                            <div style="font-weight: 600;">${result.model_metrics.accuracy.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>
                
                <div style="background: white; padding: 1rem; border-radius: 0.5rem; text-align: left;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">How it works:</div>
                    <ul style="font-size: 0.875rem; color: var(--text-muted); padding-left: 1.5rem;">
                        <li>Ensemble model (Random Forest + Gradient Boosting)</li>
                        <li>Trained on ${result.training_samples} historical records</li>
                        <li>9 engineered features including lags and trends</li>
                        <li>Tested on ${result.test_samples} samples for validation</li>
                    </ul>
                </div>
            </div>
        `;
        
        document.getElementById('priceResult').innerHTML = resultHTML;
    } catch (error) {
        console.error('Prediction error:', error);
        document.getElementById('priceResult').innerHTML = `
            <div class="text-center text-muted" style="padding: 2rem;">
                <p class="icon">❌</p>
                <h3>Prediction Failed</h3>
                <p>${error.message}</p>
                <p style="font-size: 0.875rem; margin-top: 1rem;">Make sure the Python backend is running on port 5000</p>
                <button class="btn btn-primary" onclick="testBackendConnection()" style="margin-top: 1rem;">Test Backend Connection</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// Test backend connection
async function testBackendConnection() {
    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const result = await response.json();
        alert(`✅ Backend is connected!\n\nStatus: ${result.status}\nTotal Records: ${result.total_records}\nCommodities: ${result.commodities}\nStates: ${result.states}`);
    } catch (error) {
        alert(`❌ Backend connection failed!\n\nError: ${error.message}\n\nMake sure to:\n1. cd /workspace/backend\n2. python app.py\n\nBackend should run on http://localhost:5000`);
    } finally {
        hideLoading();
    }
}

// Crop Recommendations
async function recommendCrops() {
    const state = document.getElementById('recState').value;
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE_URL}/recommend/crops`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: state || undefined, top_n: 10 })
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        const resultHTML = `
            <div class="card">
                <div class="card-header">
                    <h2>🏆 Top 10 Recommended Crops</h2>
                    <p>Ranked by profitability score</p>
                </div>
                <div class="card-body">
                    ${result.recommendations.map((rec, i) => `
                        <div style="padding: 1.5rem; background: ${i === 0 ? '#FEF3C7' : i === 1 ? '#E5E7EB' : i === 2 ? '#FED7AA' : 'white'}; border-radius: 0.5rem; margin-bottom: 1rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div style="width: 40px; height: 40px; background: ${i < 3 ? '#DCFCE7' : '#F3F4F6'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.25rem;">
                                        ${i + 1}
                                    </div>
                                    <div>
                                        <h3 style="font-size: 1.125rem; font-weight: 600;">${rec.commodity}</h3>
                                        <p style="font-size: 0.875rem; color: var(--text-muted);">${rec.reason}</p>
                                    </div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 2rem; font-weight: 700; color: var(--primary);">${rec.score.toFixed(1)}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">score</div>
                                </div>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; font-size: 0.875rem;">
                                <div>
                                    <div style="color: var(--text-muted);">Avg Price</div>
                                    <div style="font-weight: 600;">₹${Math.round(rec.avg_price)}</div>
                                </div>
                                <div>
                                    <div style="color: var(--text-muted);">Stability</div>
                                    <div style="font-weight: 600;">${rec.price_stability.toFixed(1)}%</div>
                                </div>
                                <div>
                                    <div style="color: var(--text-muted);">Availability</div>
                                    <div style="font-weight: 600;">${rec.market_availability.toFixed(1)}%</div>
                                </div>
                                <div>
                                    <div style="color: var(--text-muted);">Profit Potential</div>
                                    <div style="font-weight: 600;">${rec.profit_potential.toFixed(1)}%</div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.getElementById('cropRecResult').innerHTML = resultHTML;
    } catch (error) {
        console.error('Recommendation error:', error);
        document.getElementById('cropRecResult').innerHTML = `
            <div class="card">
                <div class="card-body text-center text-muted">
                    <p class="icon">❌</p>
                    <h3>Recommendation Failed</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-primary" onclick="testBackendConnection()" style="margin-top: 1rem;">Test Backend Connection</button>
                </div>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// Yield Prediction
async function predictYield() {
    const landSize = parseFloat(document.getElementById('yieldLand').value) || 0;
    const commodity = document.getElementById('yieldCrop').value;
    const fertilizer = parseFloat(document.getElementById('yieldFert').value) || 0;
    const irrigation = parseFloat(document.getElementById('yieldIrr').value) || 0;
    const labor = parseFloat(document.getElementById('yieldLabor').value) || 0;
    
    if (!commodity || landSize === 0) {
        alert('Please fill required fields');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE_URL}/predict/yield`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                commodity,
                land_size: landSize,
                fertilizer_cost: fertilizer,
                irrigation_cost: irrigation,
                labor_cost: labor
            })
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        const resultHTML = `
            <div style="text-align: center; padding: 2rem;">
                <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Expected Yield</div>
                <div style="font-size: 4rem; font-weight: 700; color: #3B82F6; margin-bottom: 1rem;">
                    ${result.expected_yield_quintals}
                </div>
                <div style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 2rem;">quintals</div>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: white; padding: 1rem; border-radius: 0.5rem;">
                        <div style="color: var(--text-muted); font-size: 0.875rem;">Minimum</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #EF4444;">${result.min_yield_quintals}</div>
                    </div>
                    <div style="background: white; padding: 1rem; border-radius: 0.5rem;">
                        <div style="color: var(--text-muted); font-size: 0.875rem;">Expected</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #3B82F6;">${result.expected_yield_quintals}</div>
                    </div>
                    <div style="background: white; padding: 1rem; border-radius: 0.5rem;">
                        <div style="color: var(--text-muted); font-size: 0.875rem;">Maximum</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #10B981;">${result.max_yield_quintals}</div>
                    </div>
                </div>
                
                <div style="background: white; padding: 1.5rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.875rem; color: var(--text-muted);">Prediction Confidence</span>
                        <span style="font-size: 1.125rem; font-weight: 700; color: #3B82F6;">${result.confidence_percent}%</span>
                    </div>
                    <div style="width: 100%; background: #E5E7EB; height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${result.confidence_percent}%; background: #3B82F6; height: 100%; transition: width 0.3s;"></div>
                    </div>
                </div>
                
                ${result.revenue_estimate ? `
                    <div style="background: white; padding: 1.5rem; border-radius: 0.5rem; text-align: left;">
                        <div style="font-weight: 600; margin-bottom: 1rem;">Revenue Estimate</div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; font-size: 0.875rem;">
                            <div>
                                <div style="color: var(--text-muted);">Avg Market Price</div>
                                <div style="font-weight: 600;">₹${Math.round(result.revenue_estimate.avg_market_price)}/quintal</div>
                            </div>
                            <div>
                                <div style="color: var(--text-muted);">Expected Revenue</div>
                                <div style="font-weight: 600; color: var(--primary);">₹${Math.round(result.revenue_estimate.expected_revenue).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        document.getElementById('yieldResult').innerHTML = resultHTML;
    } catch (error) {
        console.error('Yield prediction error:', error);
        document.getElementById('yieldResult').innerHTML = `
            <div class="text-center text-muted" style="padding: 2rem;">
                <p class="icon">❌</p>
                <h3>Prediction Failed</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="testBackendConnection()" style="margin-top: 1rem;">Test Backend Connection</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// Demand Analysis
async function analyzeDemand() {
    const commodity = document.getElementById('demandCommodity').value;
    
    if (!commodity) {
        alert('Please select a commodity');
        return;
    }
    
    showLoading();
    
    try {
        const response = await fetch(`${API_BASE_URL}/forecast/demand`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commodity })
        });
        
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        const demandColors = {
            'high': '#10B981',
            'medium': '#F59E0B',
            'low': '#EF4444'
        };
        
        const trendIcons = {
            'increasing': '↑',
            'stable': '→',
            'decreasing': '↓'
        };
        
        const resultHTML = `
            <div style="padding: 2rem;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 1.5rem;">
                    <div style="background: white; padding: 2rem; border-radius: 0.5rem; text-align: center;">
                        <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Current Demand</div>
                        <div style="font-size: 3rem; font-weight: 700; color: ${demandColors[result.current_demand]};">
                            ${result.current_demand.toUpperCase()}
                        </div>
                    </div>
                    
                    <div style="background: white; padding: 2rem; border-radius: 0.5rem; text-align: center;">
                        <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Price Trend</div>
                        <div style="font-size: 3rem; font-weight: 700; color: ${result.trend === 'increasing' ? '#10B981' : result.trend === 'stable' ? '#3B82F6' : '#EF4444'}; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                            ${trendIcons[result.trend]}
                            <span style="font-size: 1.25rem;">${result.trend}</span>
                        </div>
                    </div>
                </div>
                
                <div style="background: white; padding: 2rem; border-radius: 0.5rem; text-align: center; margin-bottom: 1.5rem;">
                    <div style="color: var(--text-muted); font-size: 0.875rem; margin-bottom: 0.5rem;">Forecasted Price</div>
                    <div style="font-size: 4rem; font-weight: 700; color: var(--purple); margin-bottom: 0.5rem;">
                        ₹${result.forecasted_price}
                    </div>
                    <div style="font-size: 0.875rem; color: var(--text-muted);">per quintal (next period)</div>
                    
                    <div style="margin-top: 1.5rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="font-size: 0.875rem; color: var(--text-muted);">Forecast Confidence</span>
                            <span style="font-size: 0.875rem; font-weight: 700; color: var(--purple);">${result.confidence_percent}%</span>
                        </div>
                        <div style="width: 100%; background: #E5E7EB; height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${result.confidence_percent}%; background: var(--purple); height: 100%; transition: width 0.3s;"></div>
                        </div>
                    </div>
                </div>
                
                <div style="background: #FEF3C7; padding: 1.5rem; border-radius: 0.5rem; border: 1px solid #FCD34D;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">💡 Recommendation:</div>
                    <p style="color: var(--text); font-size: 0.875rem;">${result.recommendation}</p>
                </div>
            </div>
        `;
        
        document.getElementById('demandResult').innerHTML = resultHTML;
    } catch (error) {
        console.error('Demand analysis error:', error);
        document.getElementById('demandResult').innerHTML = `
            <div class="text-center text-muted" style="padding: 2rem;">
                <p class="icon">❌</p>
                <h3>Analysis Failed</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="testBackendConnection()" style="margin-top: 1rem;">Test Backend Connection</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// Loading overlay
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}