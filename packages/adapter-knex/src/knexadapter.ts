import type {
    SessionSchema,
    Adapter,
    InitializeAdapter,
    UserSchema,
    KeySchema
} from "lucia";
import type { Knex } from "Knex";
import { helper, getSetArgs, escapeName } from "./utils.js";

export const mysql2Adapter = (
    knex: Knex,
    tables: {
        user: string;
        session: string | null;
        key: string;
    }
): (LuciaError) => { getUserAndSession: (sessionId: string) => Promise<void> } => {
    const ESCAPED_USER_TABLE_NAME = escapeName(tables.user);
    const ESCAPED_SESSION_TABLE_NAME = tables.session
        ? escapeName(tables.session)
        : null;
    const ESCAPED_KEY_TABLE_NAME = escapeName(tables.key);

    const USERTABLE_USER_STRING = "id";

    const KEY_TABLE_SESSION_STRING = "id";
    const KEY_TABLE_USER_STRING = "user_id";
    const KEY_TABLE_PASS_STRING = "hashed_password";

    const SESSION_TABLE_SESSION_STRING = "id";
    const SESSION_TABLE_USER_STRING = "user_id";
    const SESSION_TABLE_ACTIVE_STRING = "active_expires";
    const SESSION_TABLE_IDLE_STRING = "idle_expires";

    return (LuciaError) => {
        // @ts-ignore
        return {
            getUserAndSession: async (sessionId: string) => {
                try {
                     const sessionAndUser = await knex.transaction(async trx => {
                        const sessionScheme = await trx(ESCAPED_SESSION_TABLE_NAME).where(SESSION_TABLE_SESSION_STRING, sessionId).first();
                        const userScheme = await trx(ESCAPED_USER_TABLE_NAME).where(USERTABLE_USER_STRING, sessionScheme[SESSION_TABLE_USER_STRING]).first();

                        return {
                            session: sessionScheme,
                            user: userScheme
                        };
                    })
                } catch(errorMessage) {
                    throw new LuciaError(errorMessage);
                }
            },

            deleteKey: async (keyId: string) => {
                await knex(ESCAPED_KEY_TABLE_NAME).where(KEY_TABLE_SESSION_STRING, keyId).del();
            },

            deleteKeysByUserId: async (userId: string) => {
                await knex(ESCAPED_KEY_TABLE_NAME).where(KEY_TABLE_USER_STRING, userId).del();
            },

            deleteUser: async (userId: string) => {
                await knex(ESCAPED_USER_TABLE_NAME).where(USERTABLE_USER_STRING, userId).del();
            },

            getKey: async (keyId: string) => {
                return knex(ESCAPED_KEY_TABLE_NAME).where(KEY_TABLE_SESSION_STRING, keyId).first();
            },

            getKeysByUserId: async (userId: string) => {
                return knex(ESCAPED_KEY_TABLE_NAME).where(KEY_TABLE_USER_STRING, userId);
            },

            getUser: async (userId: string) => {
                return knex(ESCAPED_USER_TABLE_NAME).where(USERTABLE_USER_STRING, userId).first();
            },

            setKey: async (keyData: KeySchema) => {
                try {
                    await knex(ESCAPED_KEY_TABLE_NAME).insert(keyData);
                } catch (error) {
                    if (error.includes("duplicate")) {
                        throw new LuciaError('AUTH_DUPLICATE_KEY_ID');
                    } else if (error.includes("invalid")) {
                        throw new LuciaError('AUTH_INVALID_USER_ID');
                    }
                    throw error;
                }
            },

            setUser: async (userData: UserSchema) => {
                let keyId;

                try {
                    // Insert user
                    const [userId] = await knex(ESCAPED_USER_TABLE_NAME).insert(userData, USERTABLE_USER_STRING);

                    // If key is defined, insert key
                    if (userData.key) {
                        keyId = await knex(ESCAPED_KEY_TABLE_NAME).insert({ ...userData.key, user_id: userId }, KEY_TABLE_SESSION_STRING);
                    }
                } catch (error) {
                    if (error.includes("duplicate")) {
                        throw new LuciaError('AUTH_DUPLICATE_KEY_ID');
                    } else {
                        throw error;
                    }
                }
            },

            updateKey: async (keyId: string, partialKey: KeySchema) => {
                await knex(ESCAPED_KEY_TABLE_NAME).where(KEY_TABLE_SESSION_STRING, keyId).update(partialKey);
            },

            updateUser: async (userId: string, partialUser: UserSchema) => {
                await knex(ESCAPED_USER_TABLE_NAME).where(USERTABLE_USER_STRING, userId).update(partialUser);
            },

            deleteSession: async (sessionId: string) => {
                await knex(ESCAPED_SESSION_TABLE_NAME).where(SESSION_TABLE_SESSION_STRING, sessionId).del();
            },

            deleteSessionsByUserId: async (userId: string) => {
                await knex(ESCAPED_SESSION_TABLE_NAME).where(SESSION_TABLE_USER_STRING, userId).del();
            },

            getSession: async (sessionId: string) => {
                return knex(ESCAPED_SESSION_TABLE_NAME).where(SESSION_TABLE_SESSION_STRING, sessionId).first();
            },

            getSessionsByUserId: async (userId: string) => {
                return knex(ESCAPED_SESSION_TABLE_NAME).where(SESSION_TABLE_USER_STRING, userId);
            },

            setSession: async (sessionData: SessionSchema) => {
                try {
                    await knex(ESCAPED_SESSION_TABLE_NAME).insert(sessionData);
                } catch (error) {
                    if (error.includes("invalid")) {
                        throw new LuciaError('AUTH_INVALID_USER_ID');
                    }
                    throw error;
                }
            },

            updateSession: async (sessionId: string, partialSession: SessionSchema) => {
                await knex(ESCAPED_SESSION_TABLE_NAME).where(SESSION_TABLE_SESSION_STRING, sessionId).update(partialSession);
            },
        };
    };
}