import { Client } from '@elastic/elasticsearch';

const globalForElastic = global as unknown as { elastic: Client };

export const elasticClient =
  globalForElastic.elastic ||
  new Client({
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  });

if (process.env.NODE_ENV !== 'production') globalForElastic.elastic = elasticClient;

export default elasticClient;
