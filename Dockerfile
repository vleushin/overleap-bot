FROM node:lts-slim

ENV NODE_ENV production

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install --production --immutable && yarn cache clean

COPY . .

CMD [ "yarn", "start" ]
