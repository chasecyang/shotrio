/**
 * Chatwoot Widget Type Definitions
 * 
 * Provides TypeScript types for the Chatwoot widget global objects.
 */

declare global {
  interface Window {
    /**
     * Chatwoot SDK main API
     */
    $chatwoot?: {
      /**
       * Toggle the chat widget open or closed
       * @param state - 'open' or 'close'
       */
      toggle: (state?: 'open' | 'close') => void;

      /**
       * Set user information
       * @param identifier - Unique user identifier
       * @param user - User information object
       */
      setUser: (
        identifier: string,
        user: {
          email?: string;
          name?: string;
          avatar_url?: string;
          identifier_hash?: string;
        }
      ) => void;

      /**
       * Set custom attributes for the conversation
       * @param attributes - Custom attributes as key-value pairs
       */
      setCustomAttributes: (attributes: Record<string, unknown>) => void;

      /**
       * Delete user information (logout)
       */
      deleteUser: () => void;

      /**
       * Add a label to the conversation
       * @param label - Label to add
       */
      setLabel: (label: string) => void;

      /**
       * Remove a label from the conversation
       * @param label - Label to remove
       */
      removeLabel: (label: string) => void;

      /**
       * Set the widget locale
       * @param locale - Locale code (e.g., 'en', 'zh_CN')
       */
      setLocale: (locale: string) => void;

      /**
       * Reset the widget state
       */
      reset: () => void;
    };

    /**
     * Chatwoot widget settings
     */
    chatwootSettings?: {
      /**
       * Hide the message bubble (default: false)
       */
      hideMessageBubble?: boolean;

      /**
       * Position of the widget (default: 'right')
       */
      position?: 'left' | 'right';

      /**
       * Locale for the widget
       */
      locale?: string;

      /**
       * Widget type
       */
      type?: 'standard' | 'expanded_bubble';

      /**
       * Launch message to show when widget is opened
       */
      launcherTitle?: string;

      /**
       * Show widget on page load
       */
      showPopoutButton?: boolean;
    };

    /**
     * Chatwoot SDK initialization
     */
    chatwootSDK?: {
      /**
       * Initialize the Chatwoot SDK
       * @param config - Configuration object
       */
      run: (config: { websiteToken: string; baseUrl: string }) => void;
    };
  }
}

export {};

