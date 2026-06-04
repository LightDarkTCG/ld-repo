import { CreatePlayerData, CreatePlayerVariables, CreateDeckData, CreateDeckVariables, ListMyDecksData, AddCardToDeckData, AddCardToDeckVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreatePlayer(options?: useDataConnectMutationOptions<CreatePlayerData, FirebaseError, CreatePlayerVariables>): UseDataConnectMutationResult<CreatePlayerData, CreatePlayerVariables>;
export function useCreatePlayer(dc: DataConnect, options?: useDataConnectMutationOptions<CreatePlayerData, FirebaseError, CreatePlayerVariables>): UseDataConnectMutationResult<CreatePlayerData, CreatePlayerVariables>;

export function useCreateDeck(options?: useDataConnectMutationOptions<CreateDeckData, FirebaseError, CreateDeckVariables>): UseDataConnectMutationResult<CreateDeckData, CreateDeckVariables>;
export function useCreateDeck(dc: DataConnect, options?: useDataConnectMutationOptions<CreateDeckData, FirebaseError, CreateDeckVariables>): UseDataConnectMutationResult<CreateDeckData, CreateDeckVariables>;

export function useListMyDecks(options?: useDataConnectQueryOptions<ListMyDecksData>): UseDataConnectQueryResult<ListMyDecksData, undefined>;
export function useListMyDecks(dc: DataConnect, options?: useDataConnectQueryOptions<ListMyDecksData>): UseDataConnectQueryResult<ListMyDecksData, undefined>;

export function useAddCardToDeck(options?: useDataConnectMutationOptions<AddCardToDeckData, FirebaseError, AddCardToDeckVariables>): UseDataConnectMutationResult<AddCardToDeckData, AddCardToDeckVariables>;
export function useAddCardToDeck(dc: DataConnect, options?: useDataConnectMutationOptions<AddCardToDeckData, FirebaseError, AddCardToDeckVariables>): UseDataConnectMutationResult<AddCardToDeckData, AddCardToDeckVariables>;
