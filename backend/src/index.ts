import app from './app';
import dotenv from 'dotenv';
import { setupCronJobs } from './services/cron.service';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, ()=>{
    // console.log('Connecting to:', process.env.EMAIL_HOST, process.env.EMAIL_PORT);
    console.log(`Server running on port ${PORT}`)
    setupCronJobs();
})
