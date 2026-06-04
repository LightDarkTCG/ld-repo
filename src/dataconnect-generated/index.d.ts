import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface AddCardToDeckData {
  deckCard_insert: DeckCard_Key;
}

export interface AddCardToDeckVariables {
  deckId: UUIDString;
  cardId: UUIDString;
  quantity: number;
}

export interface Card_Key {
  id: UUIDString;
  __typename?: 'Card_Key';
}

export interface Collection_Key {
  playerId: UUIDString;
  cardId: UUIDString;
  __typename?: 'Collection_Key';
}

export interface CreateDeckData {
  deck_insert: Deck_Key;
}

export interface CreateDeckVariables {
  deckName: string;
  playerId: UUIDString;
}

export interface CreatePlayerData {
  player_insert: Player_Key;
}

export interface CreatePlayerVariables {
  username: string;
  email: string;
}

export interface DeckCard_Key {
  deckId: UUIDString;
  cardId: UUIDString;
  __typename?: 'DeckCard_Key';
}

export interface Deck_Key {
  id: UUIDString;
  __typename?: 'Deck_Key';
}

export interface ListMyDecksData {
  decks: ({
    deckName: string;
    createdAt: TimestampString;
    cards_via_DeckCard: ({
      name: string;
      attack: number;
      health: number;
    })[];
  })[];
}

export interface Match_Key {
  id: UUIDString;
  __typename?: 'Match_Key';
}

export interface Player_Key {
  id: UUIDString;
  __typename?: 'Player_Key';
}

interface CreatePlayerRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePlayerVariables): MutationRef<CreatePlayerData, CreatePlayerVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreatePlayerVariables): MutationRef<CreatePlayerData, CreatePlayerVariables>;
  operationName: string;
}
export const createPlayerRef: CreatePlayerRef;

export function createPlayer(vars: CreatePlayerVariables): MutationPromise<CreatePlayerData, CreatePlayerVariables>;
export function createPlayer(dc: DataConnect, vars: CreatePlayerVariables): MutationPromise<CreatePlayerData, CreatePlayerVariables>;

interface CreateDeckRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDeckVariables): MutationRef<CreateDeckData, CreateDeckVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateDeckVariables): MutationRef<CreateDeckData, CreateDeckVariables>;
  operationName: string;
}
export const createDeckRef: CreateDeckRef;

export function createDeck(vars: CreateDeckVariables): MutationPromise<CreateDeckData, CreateDeckVariables>;
export function createDeck(dc: DataConnect, vars: CreateDeckVariables): MutationPromise<CreateDeckData, CreateDeckVariables>;

interface ListMyDecksRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyDecksData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMyDecksData, undefined>;
  operationName: string;
}
export const listMyDecksRef: ListMyDecksRef;

export function listMyDecks(options?: ExecuteQueryOptions): QueryPromise<ListMyDecksData, undefined>;
export function listMyDecks(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyDecksData, undefined>;

interface AddCardToDeckRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddCardToDeckVariables): MutationRef<AddCardToDeckData, AddCardToDeckVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddCardToDeckVariables): MutationRef<AddCardToDeckData, AddCardToDeckVariables>;
  operationName: string;
}
export const addCardToDeckRef: AddCardToDeckRef;

export function addCardToDeck(vars: AddCardToDeckVariables): MutationPromise<AddCardToDeckData, AddCardToDeckVariables>;
export function addCardToDeck(dc: DataConnect, vars: AddCardToDeckVariables): MutationPromise<AddCardToDeckData, AddCardToDeckVariables>;

