module.exports = {
    returnSuccess: (body, callback) => {
        const response = {
            statusCode: 200,
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://nmzl.us'
            }
        };
        callback(null, response);
    },

    returnError: (error, callback) => {
        callback(error);
    }
};