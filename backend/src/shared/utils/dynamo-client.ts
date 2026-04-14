import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';

const raw = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'eu-west-1' });

export const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE = process.env.TABLE_NAME!;

// ── Helpers ────────────────────────────────────────────────────────────────

export async function getItem<T>(pk: string, sk: string): Promise<T | null> {
  const { Item } = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: pk, SK: sk } }));
  return (Item as T) ?? null;
}

export async function putItem<T extends object>(item: T): Promise<void> {
  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
}

export async function deleteItem(pk: string, sk: string): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: pk, SK: sk } }));
}

export async function queryItems<T>(params: Omit<QueryCommandInput, 'TableName'>): Promise<{ items: T[]; lastKey?: Record<string, unknown> }> {
  const { Items = [], LastEvaluatedKey } = await ddb.send(
    new QueryCommand({ TableName: TABLE, ...params })
  );
  return { items: Items as T[], lastKey: LastEvaluatedKey as Record<string, unknown> | undefined };
}

export async function updateItem(
  pk: string,
  sk: string,
  updates: Record<string, unknown>
): Promise<void> {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  const expr = 'SET ' + keys.map(k => `#${k} = :${k}`).join(', ') + ', #updatedAt = :updatedAt';
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };
  keys.forEach(k => {
    names[`#${k}`] = k;
    values[`:${k}`] = updates[k];
  });
  names['#updatedAt'] = 'updatedAt';

  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: pk, SK: sk },
    UpdateExpression: expr,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}
