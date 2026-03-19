module.exports = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['apikey'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid API key'
    });
  }
  
  next();
};
