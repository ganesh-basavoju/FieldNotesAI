import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useAppStore } from './store';

/**
 * Hook that returns whether the user is authenticated (has a token in local storage).
 * Works offline — checks the token loaded from AsyncStorage during app init.
 */
export function useIsAuthenticated(): boolean {
    return useAppStore((s) => !!s.authToken);
}

/**
 * Show a native alert prompting the user to sign in.
 * Provides a "Sign In" button that navigates to the login screen.
 */
export function showSignInRequired(message?: string): void {
    Alert.alert(
        'Sign In Required',
        message || 'Please sign in to continue.',
        [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign In',
                onPress: () => router.push('/(auth)/login'),
            },
        ],
        { cancelable: true }
    );
}
