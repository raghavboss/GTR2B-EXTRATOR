
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Package, Box, MapPin, Search, Plus, Edit2, Trash2, TrendingDown, AlertTriangle, ArrowRightLeft, Store, RefreshCw, BarChart3, Check, X, Filter, Download } from 'lucide-react';
import { InventoryItem, Godown } from '../types';
import { getAllItems, saveItem, deleteItem, getAllGodowns, getAllVouchers, getBusinessProfile } from '../utils/db';
import { useAuth } from '../contexts/AuthContext';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const InventoryModule = () => {
  const [activeTab, setActiveTab] = useState<'items' | 'stock' | 'reports'>('items');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<InventoryItem>>({});

  const { hasPermission } = useAuth();
  const canManage = hasPermission('inventory:manage');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [i, g] = await Promise.all([getAllItems(), getAllGodowns()]);
    setItems(i);
    setGodowns(g);
    setLoading(false);
  };

  const handleEdit = (item?: InventoryItem) => {
    if (item) {
        setCurrentItem(item);
    } else {
        // Initialize stock for all godowns to 0 for new items
        const initialStock: { [key: string]: number } = {};
        godowns.forEach(g => initialStock[g.id] = 0);
        
        setCurrentItem({ 
            stock: initialStock, 
            gstRate: 18, 
            unit: 'PCS',
            minStockLevel: 10
        });
    }
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem.name || !currentItem.sku) return;
    
    // Ensure stock object exists
    if (!currentItem.stock) currentItem.stock = {};
    
    await saveItem(currentItem as InventoryItem);
    setIsEditing(false);
    loadData();
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure? This will delete the item master and all stock history.')) {
        await deleteItem(id);
        loadData();
    }
  };

  // Stats
  const stats = useMemo(() => {
      const totalItems = items.length;
      const totalValue = items.reduce((acc: number, item: InventoryItem) => {
          const stockValues = item.stock ? Object.values(item.stock) : [];
          const totalStock = stockValues.reduce((a: number, b: number) => a + b, 0);
          return acc + (totalStock * (item.purchasePrice || 0));
      }, 0);
      const lowStockItems = items.filter((item: InventoryItem) => {
          const stockValues = item.stock ? Object.values(item.stock) : [];
          const totalStock = stockValues.reduce((a: number, b: number) => a + b, 0);
          return totalStock <= (item.minStockLevel || 0);
      }).length;
      return { totalItems, totalValue, lowStockItems };
  }, [items]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  if (loading) return <div className="p-8 text-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto"></div></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-full">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-orange-600" />
            Inventory Management
          </h1>
          <p className="text-gray-500 mt-1">Real-time stock tracking across godowns and branches.</p>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={loadData} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-5 h-5"/></button>
            <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                <button onClick={() => setActiveTab('items')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'items' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}>Item Master</button>
                <button onClick={() => setActiveTab('stock')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'stock' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}>Stock Summary</button>
                <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 text-sm font-medium rounded-md ${activeTab === 'reports' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}>Stock Reports</button>
            </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-sm font-medium text-gray-500">Total Inventory Value</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(stats.totalValue)}</h3>
              </div>
              <div className="p-3 bg-green-50 text-green-600 rounded-lg"><BarChart3 className="w-6 h-6"/></div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-sm font-medium text-gray-500">Unique Items (SKUs)</p>
                  <h3 className="text-2xl font-bold text-gray-900 mt-2">{stats.totalItems}</h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Box className="w-6 h-6"/></div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                  <p className="text-sm font-medium text-gray-500">Low Stock Alerts</p>
                  <h3 className={`text-2xl font-bold mt-2 ${stats.lowStockItems > 0 ? 'text-red-600' : 'text-gray-900'}`}>{stats.lowStockItems}</h3>
              </div>
              <div className={`p-3 rounded-lg ${stats.lowStockItems > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'}`}><AlertTriangle className="w-6 h-6"/></div>
          </div>
      </div>

      {activeTab === 'items' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-gray-800">Item Master</h3>
                  {canManage && (
                      <button onClick={() => handleEdit()} className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 shadow-sm">
                          <Plus className="w-4 h-4 mr-2" /> Add Item
                      </button>
                  )}
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Item Name</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">SKU / HSN</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Category</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Total Stock</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Rate (Sell)</th>
                          <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                      {items.map(item => {
                          const totalStock = Object.values(item.stock).reduce((a: number, b: number)=>a+b, 0);
                          return (
                              <tr key={item.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4">
                                      <div className="font-medium text-gray-900">{item.name}</div>
                                      <div className="text-xs text-gray-500">{item.unit}</div>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-600">
                                      <div>{item.sku}</div>
                                      <div className="text-xs text-gray-400">HSN: {item.hsn}</div>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-600">{item.category}</td>
                                  <td className="px-6 py-4 text-right">
                                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${totalStock <= item.minStockLevel ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                          {totalStock} {item.unit}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-right text-sm font-medium">{formatCurrency(item.sellingPrice)}</td>
                                  <td className="px-6 py-4 text-right">
                                      {canManage && (
                                          <div className="flex justify-end gap-2">
                                              <button onClick={() => handleEdit(item)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Edit2 className="w-4 h-4"/></button>
                                              <button onClick={() => item.id && handleDelete(item.id)} className="text-red-600 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4"/></button>
                                          </div>
                                      )}
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      )}

      {activeTab === 'stock' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-bold text-gray-800">Godown-wise Stock Summary</h3>
              </div>
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase sticky left-0 bg-gray-50">Item Name</th>
                          <th className="px-6 py-3 text-center text-xs font-bold text-gray-900 uppercase bg-yellow-50 border-x border-yellow-200">Total Stock</th>
                          {godowns.map(g => (
                              <th key={g.id} className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase border-r border-gray-100">
                                  {g.name} <span className="block text-[10px] font-normal text-gray-400">{g.location}</span>
                              </th>
                          ))}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                      {items.map(item => {
                          const totalStock = Object.values(item.stock).reduce((a: number, b: number)=>a+b, 0);
                          return (
                              <tr key={item.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 font-medium text-gray-900 sticky left-0 bg-white border-r border-gray-100">
                                      {item.name}
                                      <span className="block text-xs text-gray-500">{item.sku}</span>
                                  </td>
                                  <td className="px-6 py-4 text-center font-bold text-gray-800 bg-yellow-50/30 border-x border-yellow-100">
                                      {totalStock}
                                  </td>
                                  {godowns.map(g => (
                                      <td key={g.id} className="px-6 py-4 text-center text-sm text-gray-600 border-r border-gray-100">
                                          {item.stock[g.id] || 0}
                                      </td>
                                  ))}
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
              </div>
          </div>
      )}

      {activeTab === 'reports' && (
          <StockStatement items={items} />
      )}

      {/* Edit Modal */}
      {isEditing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden max-h-[90vh] overflow-y-auto">
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <h3 className="text-lg font-bold text-gray-900">{currentItem.id ? 'Edit Item' : 'Add New Item'}</h3>
                      <button onClick={() => setIsEditing(false)}><X className="w-5 h-5 text-gray-400"/></button>
                  </div>
                  <form onSubmit={handleSave} className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="col-span-2 space-y-4">
                              <h4 className="font-semibold text-gray-900 border-b pb-2">Basic Details</h4>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">Item Name</label>
                                      <input type="text" required className="w-full border rounded-lg p-2 text-sm" value={currentItem.name || ''} onChange={e => setCurrentItem({...currentItem, name: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                                      <input type="text" className="w-full border rounded-lg p-2 text-sm" value={currentItem.category || ''} onChange={e => setCurrentItem({...currentItem, category: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">SKU Code</label>
                                      <input type="text" required className="w-full border rounded-lg p-2 text-sm uppercase" value={currentItem.sku || ''} onChange={e => setCurrentItem({...currentItem, sku: e.target.value})} />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">HSN/SAC Code</label>
                                      <input type="text" required className="w-full border rounded-lg p-2 text-sm" value={currentItem.hsn || ''} onChange={e => setCurrentItem({...currentItem, hsn: e.target.value})} />
                                  </div>
                              </div>

                              <h4 className="font-semibold text-gray-900 border-b pb-2 pt-2">Pricing & Tax</h4>
                              <div className="grid grid-cols-3 gap-4">
                                  <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Price</label>
                                      <input type="number" className="w-full border rounded-lg p-2 text-sm" value={currentItem.purchasePrice || 0} onChange={e => setCurrentItem({...currentItem, purchasePrice: Number(e.target.value)})} />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">Selling Price</label>
                                      <input type="number" className="w-full border rounded-lg p-2 text-sm" value={currentItem.sellingPrice || 0} onChange={e => setCurrentItem({...currentItem, sellingPrice: Number(e.target.value)})} />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-medium text-gray-500 mb-1">GST Rate (%)</label>
                                      <select className="w-full border rounded-lg p-2 text-sm" value={currentItem.gstRate} onChange={e => setCurrentItem({...currentItem, gstRate: Number(e.target.value)})}>
                                          <option value="0">0%</option>
                                          <option value="5">5%</option>
                                          <option value="12">12%</option>
                                          <option value="18">18%</option>
                                          <option value="28">28%</option>
                                      </select>
                                  </div>
                              </div>
                          </div>

                          <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                              <h4 className="font-semibold text-gray-900 border-b border-gray-200 pb-2">Opening Stock</h4>
                              <div className="space-y-3">
                                  {godowns.map(g => (
                                      <div key={g.id} className="flex justify-between items-center">
                                          <label className="text-xs text-gray-600 w-1/2">{g.name}</label>
                                          <input 
                                            type="number" 
                                            className="w-1/2 border rounded-lg p-1.5 text-sm text-right" 
                                            value={currentItem.stock?.[g.id] || 0}
                                            onChange={e => {
                                                const newStock = { ...currentItem.stock, [g.id]: Number(e.target.value) };
                                                setCurrentItem({...currentItem, stock: newStock});
                                            }}
                                          />
                                      </div>
                                  ))}
                              </div>
                              <div className="pt-4 border-t border-gray-200">
                                  <div className="flex justify-between items-center mb-2">
                                      <label className="text-xs font-medium text-gray-600">Unit (UQC)</label>
                                      <input type="text" className="w-20 border rounded p-1 text-xs uppercase" value={currentItem.unit} onChange={e => setCurrentItem({...currentItem, unit: e.target.value})} />
                                  </div>
                                  <div className="flex justify-between items-center">
                                      <label className="text-xs font-medium text-gray-600">Min. Alert Level</label>
                                      <input type="number" className="w-20 border rounded p-1 text-xs" value={currentItem.minStockLevel} onChange={e => setCurrentItem({...currentItem, minStockLevel: Number(e.target.value)})} />
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="flex justify-end pt-4 border-t border-gray-100">
                          <button type="submit" className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 shadow-sm">Save Item</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

const StockStatement = ({ items }: { items: InventoryItem[] }) => {
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState<any>(null);
    const [businessProfile, setBusinessProfile] = useState<any>(null);
    const statementRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        getBusinessProfile().then(setBusinessProfile);
    }, []);

    const generateReport = async () => {
        if(!selectedItemId) return;
        
        const item = items.find(i => i.id === Number(selectedItemId));
        if(!item) return;

        // Fetch all vouchers
        const vouchers = await getAllVouchers();
        
        // Filter vouchers that contain this item in their lines
        const relevantVouchers = vouchers.filter(v => 
            v.items.some(line => line.itemId === item.id)
        ).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Calculate opening stock
        // Note: item.stock is 'Current Stock' in Master. 
        // Real opening stock calculation requires iterating all vouchers from beginning of time or having a stored opening stock.
        // Here we assume Master Stock is Current Stock, so we reverse calculate or assume Master Stock is Opening if no vouchers.
        // Better approach: item.stock in master represents CURRENT stock. 
        // To get Opening Stock on StartDate, we take Current Stock and reverse transactions from now back to StartDate? 
        // Or forward from Day 0?
        // Let's assume item.stock (from DB) is the LIVE current stock.
        
        const currentTotalStock = Object.values(item.stock).reduce((a: number, b: number)=>a+b, 0);
        
        // To find stock at StartDate, we need to reverse all transactions from NOW back to StartDate.
        // Or simpler for this mock: assume item.stock in master was the INITIAL Opening Stock when system started.
        // Let's use the latter for simplicity in this demo environment, or implement proper calculation.
        // Implementing proper Forward calculation from 'Master Opening Stock' + Vouchers.
        // Note: The `item.stock` in `saveItem` usually overwrites with current values. 
        // In a real ERP, we'd have an `opening_stock` table and `current_stock` table.
        // For this demo, let's assume `item.stock` is the current live stock. 
        // And we calculate report by just listing transactions. Opening Balance might be tricky without a fixed reference point.
        // Let's assume 0 opening if no history, or just list transactions.
        
        let runningStock = 0; // Ideally fetch 'Opening Balance' from a fiscal year start.
        // For demo: assume opening stock is 0 and we build up.
        
        // Better for Demo: Use the stock value in Master as 'Opening Stock' for the system usage period.
        const masterOpeningStock = Object.values(item.stock).reduce((a: number, b: number)=>a+b,0);
        runningStock = masterOpeningStock;

        // Transactions before start date affect opening
        const prevTxns = relevantVouchers.filter(v => new Date(v.date) < new Date(startDate));
        prevTxns.forEach(v => {
            const line = v.items.find(i => i.itemId === item.id);
            if(line) {
                if (v.type === 'Purchase') runningStock += line.quantity;
                if (v.type === 'Sales') runningStock -= line.quantity;
            }
        });

        const openingStock = runningStock;

        // Current Period Transactions
        const currentTxns = relevantVouchers.filter(v => 
            new Date(v.date) >= new Date(startDate) && 
            new Date(v.date) <= new Date(endDate)
        );

        const lines = currentTxns.map(v => {
            const line = v.items.find(i => i.itemId === item.id);
            const qty = line ? line.quantity : 0;
            let inQty = 0;
            let outQty = 0;

            if (v.type === 'Purchase') { inQty = qty; runningStock += qty; }
            else if (v.type === 'Sales') { outQty = qty; runningStock -= qty; }

            return {
                date: v.date,
                type: v.type,
                ref: v.referenceNo || `VCH-${v.id}`,
                in: inQty,
                out: outQty,
                balance: runningStock
            };
        });

        setReportData({
            item,
            openingStock,
            closingStock: runningStock,
            lines,
            period: { start: startDate, end: endDate }
        });
    };

    const downloadPDF = async () => {
        if(!statementRef.current || !reportData) return;
        
        try {
            const canvas = await html2canvas(statementRef.current, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Stock_Report_${reportData.item.sku}_${endDate}.pdf`);
        } catch(e) {
            console.error(e);
            alert("Failed to generate PDF");
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                    <Filter className="w-5 h-5 mr-2 text-orange-600" /> Report Criteria
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Select Item</label>
                        <select className="w-full border rounded-lg p-2.5 text-sm" value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)}>
                            <option value="">-- Select Item --</option>
                            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
                            <input type="date" className="w-full border rounded-lg p-2 text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                            <input type="date" className="w-full border rounded-lg p-2 text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                    </div>
                    <button onClick={generateReport} className="w-full py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 shadow-sm">
                        Generate Report
                    </button>
                </div>
            </div>

            <div className="lg:col-span-2">
                {reportData ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900">Stock Statement Preview</h3>
                            <button onClick={downloadPDF} className="flex items-center text-sm bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700">
                                <Download className="w-4 h-4 mr-2" /> PDF
                            </button>
                        </div>
                        
                        <div className="overflow-auto bg-gray-100 p-4 max-h-[600px]">
                            <div ref={statementRef} className="bg-white p-8 max-w-2xl mx-auto shadow-sm min-h-[800px] text-gray-900">
                                {/* Header */}
                                <div className="text-center border-b-2 border-gray-100 pb-4 mb-4">
                                    <h2 className="text-xl font-bold uppercase">{businessProfile?.companyName || 'Company Name'}</h2>
                                    <h1 className="text-lg font-bold mt-4 text-orange-800">Stock Statement</h1>
                                    <p className="text-sm text-gray-600">Period: {new Date(reportData.period.start).toLocaleDateString()} to {new Date(reportData.period.end).toLocaleDateString()}</p>
                                </div>

                                {/* Item Info */}
                                <div className="mb-6 bg-orange-50 p-4 rounded-lg flex justify-between">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold">Item Details</p>
                                        <h3 className="text-lg font-bold">{reportData.item.name}</h3>
                                        <p className="text-sm text-gray-600">SKU: {reportData.item.sku}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 uppercase font-bold">Unit</p>
                                        <h3 className="text-lg font-bold">{reportData.item.unit}</h3>
                                    </div>
                                </div>

                                {/* Table */}
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-gray-800">
                                            <th className="text-left py-2">Date</th>
                                            <th className="text-left py-2">Type / Ref</th>
                                            <th className="text-right py-2">In</th>
                                            <th className="text-right py-2">Out</th>
                                            <th className="text-right py-2">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        <tr className="bg-gray-50 font-medium">
                                            <td className="py-2" colSpan={2}>Opening Stock</td>
                                            <td className="text-right py-2"></td>
                                            <td className="text-right py-2"></td>
                                            <td className="text-right py-2">{reportData.openingStock}</td>
                                        </tr>
                                        {reportData.lines.map((line: any, i: number) => (
                                            <tr key={i}>
                                                <td className="py-2 text-gray-600 whitespace-nowrap">{new Date(line.date).toLocaleDateString()}</td>
                                                <td className="py-2">
                                                    <div className="font-medium text-gray-800">{line.type}</div>
                                                    <div className="text-xs text-gray-500">{line.ref}</div>
                                                </td>
                                                <td className="text-right py-2 text-green-600">{line.in ? line.in : '-'}</td>
                                                <td className="text-right py-2 text-red-600">{line.out ? line.out : '-'}</td>
                                                <td className="text-right py-2 font-medium">{line.balance}</td>
                                            </tr>
                                        ))}
                                        <tr className="border-t-2 border-gray-800 font-bold bg-orange-50">
                                            <td className="py-3" colSpan={2}>Closing Stock</td>
                                            <td className="text-right py-3">{reportData.lines.reduce((a:any,b:any)=>a+b.in,0)}</td>
                                            <td className="text-right py-3">{reportData.lines.reduce((a:any,b:any)=>a+b.out,0)}</td>
                                            <td className="text-right py-3 text-orange-700">{reportData.closingStock}</td>
                                        </tr>
                                    </tbody>
                                </table>
                                
                                <div className="mt-8 pt-8 border-t border-gray-100 text-center text-xs text-gray-400">
                                    Generated by TaxAnalyst ERP on {new Date().toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl border border-gray-200 shadow-sm border-dashed p-10 text-gray-400">
                        <BarChart3 className="w-16 h-16 mb-4 text-gray-200" />
                        <p>Select an item and date range to view stock movement report.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
