import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors(
    {        origin: '*', // Allow all origins
        credentials: true // Allow credentials}
    }
));

app.get('/api/hello', (req, res) => {
    res.send('Hello World!');
});

const PORT =  3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});