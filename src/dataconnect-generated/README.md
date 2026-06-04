# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListMyDecks*](#listmydecks)
- [**Mutations**](#mutations)
  - [*CreatePlayer*](#createplayer)
  - [*CreateDeck*](#createdeck)
  - [*AddCardToDeck*](#addcardtodeck)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListMyDecks
You can execute the `ListMyDecks` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMyDecks(options?: ExecuteQueryOptions): QueryPromise<ListMyDecksData, undefined>;

interface ListMyDecksRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMyDecksData, undefined>;
}
export const listMyDecksRef: ListMyDecksRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMyDecks(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMyDecksData, undefined>;

interface ListMyDecksRef {
  ...
  (dc: DataConnect): QueryRef<ListMyDecksData, undefined>;
}
export const listMyDecksRef: ListMyDecksRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMyDecksRef:
```typescript
const name = listMyDecksRef.operationName;
console.log(name);
```

### Variables
The `ListMyDecks` query has no variables.
### Return Type
Recall that executing the `ListMyDecks` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMyDecksData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListMyDecks`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMyDecks } from '@dataconnect/generated';


// Call the `listMyDecks()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMyDecks();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMyDecks(dataConnect);

console.log(data.decks);

// Or, you can use the `Promise` API.
listMyDecks().then((response) => {
  const data = response.data;
  console.log(data.decks);
});
```

### Using `ListMyDecks`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMyDecksRef } from '@dataconnect/generated';


// Call the `listMyDecksRef()` function to get a reference to the query.
const ref = listMyDecksRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMyDecksRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.decks);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.decks);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreatePlayer
You can execute the `CreatePlayer` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createPlayer(vars: CreatePlayerVariables): MutationPromise<CreatePlayerData, CreatePlayerVariables>;

interface CreatePlayerRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreatePlayerVariables): MutationRef<CreatePlayerData, CreatePlayerVariables>;
}
export const createPlayerRef: CreatePlayerRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createPlayer(dc: DataConnect, vars: CreatePlayerVariables): MutationPromise<CreatePlayerData, CreatePlayerVariables>;

interface CreatePlayerRef {
  ...
  (dc: DataConnect, vars: CreatePlayerVariables): MutationRef<CreatePlayerData, CreatePlayerVariables>;
}
export const createPlayerRef: CreatePlayerRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createPlayerRef:
```typescript
const name = createPlayerRef.operationName;
console.log(name);
```

### Variables
The `CreatePlayer` mutation requires an argument of type `CreatePlayerVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreatePlayerVariables {
  username: string;
  email: string;
}
```
### Return Type
Recall that executing the `CreatePlayer` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreatePlayerData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreatePlayerData {
  player_insert: Player_Key;
}
```
### Using `CreatePlayer`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createPlayer, CreatePlayerVariables } from '@dataconnect/generated';

// The `CreatePlayer` mutation requires an argument of type `CreatePlayerVariables`:
const createPlayerVars: CreatePlayerVariables = {
  username: ..., 
  email: ..., 
};

// Call the `createPlayer()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createPlayer(createPlayerVars);
// Variables can be defined inline as well.
const { data } = await createPlayer({ username: ..., email: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createPlayer(dataConnect, createPlayerVars);

console.log(data.player_insert);

// Or, you can use the `Promise` API.
createPlayer(createPlayerVars).then((response) => {
  const data = response.data;
  console.log(data.player_insert);
});
```

### Using `CreatePlayer`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createPlayerRef, CreatePlayerVariables } from '@dataconnect/generated';

// The `CreatePlayer` mutation requires an argument of type `CreatePlayerVariables`:
const createPlayerVars: CreatePlayerVariables = {
  username: ..., 
  email: ..., 
};

// Call the `createPlayerRef()` function to get a reference to the mutation.
const ref = createPlayerRef(createPlayerVars);
// Variables can be defined inline as well.
const ref = createPlayerRef({ username: ..., email: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createPlayerRef(dataConnect, createPlayerVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.player_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.player_insert);
});
```

## CreateDeck
You can execute the `CreateDeck` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createDeck(vars: CreateDeckVariables): MutationPromise<CreateDeckData, CreateDeckVariables>;

interface CreateDeckRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateDeckVariables): MutationRef<CreateDeckData, CreateDeckVariables>;
}
export const createDeckRef: CreateDeckRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createDeck(dc: DataConnect, vars: CreateDeckVariables): MutationPromise<CreateDeckData, CreateDeckVariables>;

interface CreateDeckRef {
  ...
  (dc: DataConnect, vars: CreateDeckVariables): MutationRef<CreateDeckData, CreateDeckVariables>;
}
export const createDeckRef: CreateDeckRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createDeckRef:
```typescript
const name = createDeckRef.operationName;
console.log(name);
```

### Variables
The `CreateDeck` mutation requires an argument of type `CreateDeckVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateDeckVariables {
  deckName: string;
  playerId: UUIDString;
}
```
### Return Type
Recall that executing the `CreateDeck` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateDeckData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateDeckData {
  deck_insert: Deck_Key;
}
```
### Using `CreateDeck`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createDeck, CreateDeckVariables } from '@dataconnect/generated';

// The `CreateDeck` mutation requires an argument of type `CreateDeckVariables`:
const createDeckVars: CreateDeckVariables = {
  deckName: ..., 
  playerId: ..., 
};

// Call the `createDeck()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createDeck(createDeckVars);
// Variables can be defined inline as well.
const { data } = await createDeck({ deckName: ..., playerId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createDeck(dataConnect, createDeckVars);

console.log(data.deck_insert);

// Or, you can use the `Promise` API.
createDeck(createDeckVars).then((response) => {
  const data = response.data;
  console.log(data.deck_insert);
});
```

### Using `CreateDeck`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createDeckRef, CreateDeckVariables } from '@dataconnect/generated';

// The `CreateDeck` mutation requires an argument of type `CreateDeckVariables`:
const createDeckVars: CreateDeckVariables = {
  deckName: ..., 
  playerId: ..., 
};

// Call the `createDeckRef()` function to get a reference to the mutation.
const ref = createDeckRef(createDeckVars);
// Variables can be defined inline as well.
const ref = createDeckRef({ deckName: ..., playerId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createDeckRef(dataConnect, createDeckVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.deck_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.deck_insert);
});
```

## AddCardToDeck
You can execute the `AddCardToDeck` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addCardToDeck(vars: AddCardToDeckVariables): MutationPromise<AddCardToDeckData, AddCardToDeckVariables>;

interface AddCardToDeckRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddCardToDeckVariables): MutationRef<AddCardToDeckData, AddCardToDeckVariables>;
}
export const addCardToDeckRef: AddCardToDeckRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addCardToDeck(dc: DataConnect, vars: AddCardToDeckVariables): MutationPromise<AddCardToDeckData, AddCardToDeckVariables>;

interface AddCardToDeckRef {
  ...
  (dc: DataConnect, vars: AddCardToDeckVariables): MutationRef<AddCardToDeckData, AddCardToDeckVariables>;
}
export const addCardToDeckRef: AddCardToDeckRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addCardToDeckRef:
```typescript
const name = addCardToDeckRef.operationName;
console.log(name);
```

### Variables
The `AddCardToDeck` mutation requires an argument of type `AddCardToDeckVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddCardToDeckVariables {
  deckId: UUIDString;
  cardId: UUIDString;
  quantity: number;
}
```
### Return Type
Recall that executing the `AddCardToDeck` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddCardToDeckData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddCardToDeckData {
  deckCard_insert: DeckCard_Key;
}
```
### Using `AddCardToDeck`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addCardToDeck, AddCardToDeckVariables } from '@dataconnect/generated';

// The `AddCardToDeck` mutation requires an argument of type `AddCardToDeckVariables`:
const addCardToDeckVars: AddCardToDeckVariables = {
  deckId: ..., 
  cardId: ..., 
  quantity: ..., 
};

// Call the `addCardToDeck()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addCardToDeck(addCardToDeckVars);
// Variables can be defined inline as well.
const { data } = await addCardToDeck({ deckId: ..., cardId: ..., quantity: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addCardToDeck(dataConnect, addCardToDeckVars);

console.log(data.deckCard_insert);

// Or, you can use the `Promise` API.
addCardToDeck(addCardToDeckVars).then((response) => {
  const data = response.data;
  console.log(data.deckCard_insert);
});
```

### Using `AddCardToDeck`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addCardToDeckRef, AddCardToDeckVariables } from '@dataconnect/generated';

// The `AddCardToDeck` mutation requires an argument of type `AddCardToDeckVariables`:
const addCardToDeckVars: AddCardToDeckVariables = {
  deckId: ..., 
  cardId: ..., 
  quantity: ..., 
};

// Call the `addCardToDeckRef()` function to get a reference to the mutation.
const ref = addCardToDeckRef(addCardToDeckVars);
// Variables can be defined inline as well.
const ref = addCardToDeckRef({ deckId: ..., cardId: ..., quantity: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addCardToDeckRef(dataConnect, addCardToDeckVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.deckCard_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.deckCard_insert);
});
```

