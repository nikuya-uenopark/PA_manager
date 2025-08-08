// Test API to check if basic functionality works
module.exports = async function handler(req, res) {
  try {
    // Basic test
    res.status(200).json({ 
      message: "API is working", 
      timestamp: new Date().toISOString(),
      method: req.method,
      environment: {
        node_version: process.version,
        database_url_exists: !!process.env.DATABASE_URL
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Test API error', 
      detail: error.message,
      stack: error.stack 
    });
  }
};
