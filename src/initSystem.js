import { userService } from './services/userService';

/**
 * Initialize the system with default admin user
 * Run this once to create the initial admin account
 */
export const initializeSystem = async () => {
    try {
        console.log('Checking for admin user...');

        // Check if admin already exists
        const adminExists = await userService.usernameExists('admin');

        if (!adminExists) {
            console.log('Creating default admin user...');
            await userService.createUser(
                'admin',           // username
                'Tienda2025*',     // password
                'admin',           // role
                'Administrador'    // displayName
            );
            console.log('✅ Admin user created successfully!');
            console.log('Username: admin');
            console.log('Password: Tienda2025*');
        } else {
            console.log('✅ Admin user already exists');
        }
    } catch (error) {
        console.error('Error initializing system:', error);
    }
};
