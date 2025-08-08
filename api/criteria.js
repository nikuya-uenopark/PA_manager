// Test criteria API without database
module.exports = async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    if (req.method === 'GET') {
      // Mock data for testing
      const mockCriteria = [
        {
          id: 1,
          name: "接客スキル",
          category: "基本スキル",
          description: "お客様への対応能力",
          sort_order: 1,
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          name: "レジ操作",
          category: "技術スキル", 
          description: "POS操作の習熟度",
          sort_order: 2,
          created_at: new Date().toISOString()
        },
        {
          id: 3,
          name: "チームワーク",
          category: "協調性",
          description: "同僚との連携能力",
          sort_order: 3,
          created_at: new Date().toISOString()
        }
      ];
      
      res.status(200).json(mockCriteria);
    } else {
      res.status(405).json({ error: 'Method not allowed in test mode' });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Test criteria API error', 
      detail: error.message,
      stack: error.stack
    });
  }
};
