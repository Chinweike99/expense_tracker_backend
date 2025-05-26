import express from 'express';
import speakeasy from 'speakeasy';

const app = express();


app.use(express.json());

const secret = speakeasy.generateSecret({ length: 20 });
console.log(secret.base32); // Store this in DB (user.twoFactorSecret)
console.log(secret.otpauth_url); // Use this to show a QR code

// Step 2: Verify code sent by user
const verified = speakeasy.totp.verify({
  secret: secret.base32,
  encoding: 'base32',
  token: '123456', // this would come from the user input
});

app.listen(4000, ()=> {
    console.log("Server is running 4000... ]']';[;] ")
})