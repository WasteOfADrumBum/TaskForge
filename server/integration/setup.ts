// Never load .env or use the application's database configuration in this suite.
process.env.JWT_SECRET = 'taskforge-integration-test-secret';
delete process.env.MONGO_URI;
