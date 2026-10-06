function errorHandler(error, req, res, next) {

    console.error(error);

    res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}

module.exports = errorHandler;