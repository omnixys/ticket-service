// import { Inject } from '@nestjs/common';
// import { Resolver, Subscription } from '@nestjs/graphql';
// import { PubSub } from 'graphql-subscriptions';

// @Resolver()
// export class TicketSubscriptionResolver {
//   constructor(@Inject('PUBSUB') private readonly pubsub: PubSub) {}

//   @Subscription(() => Object, {
//     resolve: (value) => value,
//   })
//   scanUpdated() {
//     return this.pubsub.asyncIterator('scanUpdated');
//   }
// }
