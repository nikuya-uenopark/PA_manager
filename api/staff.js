// Test staff API without database
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
      const mockStaff = [
        {
          id: 1,
          name: "テストユーザー1",
          position: "バイト",
          joined: "2024-01-01",
          created_at: new Date().toISOString()
        },
        {
          id: 2, 
          name: "テストユーザー2",
          position: "パート",
          joined: "2024-02-01",
          created_at: new Date().toISOString()
        }
      ];
      
      res.status(200).json(mockStaff);
    } else {
      res.status(405).json({ error: 'Method not allowed in test mode' });
    }
  } catch (error) {
    res.status(500).json({ 
      error: 'Test staff API error', 
      detail: error.message,
      stack: error.stack
    });
  }
};
