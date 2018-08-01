"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var mqtt_1 = require("mqtt");
var pubsub_async_iterator_1 = require("./pubsub-async-iterator");
var MQTTPubSub = (function () {
    function MQTTPubSub(options) {
        if (options === void 0) { options = {}; }
        this.triggerTransform = options.triggerTransform || (function (trigger) { return trigger; });
        if (options.client) {
            this.mqttConnection = options.client;
        }
        else {
            var brokerUrl = options.brokerUrl || 'mqtt://localhost';
            this.mqttConnection = mqtt_1.connect(brokerUrl);
        }
        this.mqttConnection.on('message', this.onMessage.bind(this));
        if (options.connectionListener) {
            this.mqttConnection.on('connect', options.connectionListener);
            this.mqttConnection.on('error', options.connectionListener);
        }
        else {
            this.mqttConnection.on('error', console.error);
        }
        this.subscriptionMap = {};
        this.subsRefsMap = {};
        this.currentSubscriptionId = 0;
        this.onMQTTSubscribe = options.onMQTTSubscribe || (function () { return null; });
        this.publishOptionsResolver = options.publishOptions || (function () { return Promise.resolve({}); });
        this.subscribeOptionsResolver = options.subscribeOptions || (function () { return Promise.resolve({}); });
        this.parseMessageWithEncoding = options.parseMessageWithEncoding;
        this.disableMessageParse = options.disableMessageParse || false;
    }
    MQTTPubSub.prototype.publish = function (trigger, payload) {
        var _this = this;
        this.publishOptionsResolver(trigger, payload).then(function (publishOptions) {
            var message = Buffer.from(JSON.stringify(payload), _this.parseMessageWithEncoding);
            _this.mqttConnection.publish(trigger, message, publishOptions);
        });
        return true;
    };
    MQTTPubSub.prototype.subscribe = function (trigger, onMessage, options) {
        var _this = this;
        var triggerName = this.triggerTransform(trigger, options);
        var id = this.currentSubscriptionId++;
        this.subscriptionMap[id] = [triggerName, onMessage];
        var refs = this.subsRefsMap[triggerName];
        if (refs && refs.length > 0) {
            var newRefs = refs.concat([id]);
            this.subsRefsMap[triggerName] = newRefs;
            return Promise.resolve(id);
        }
        else {
            return new Promise(function (resolve, reject) {
                _this.subscribeOptionsResolver(trigger, options).then(function (subscriptionOptions) {
                    _this.mqttConnection.subscribe(triggerName, __assign({ qos: 0 }, subscriptionOptions), function (err, granted) {
                        if (err) {
                            reject(err);
                        }
                        else {
                            var subscriptionIds = _this.subsRefsMap[triggerName] || [];
                            _this.subsRefsMap[triggerName] = subscriptionIds.concat([id]);
                            resolve(id);
                            _this.onMQTTSubscribe(id, granted);
                        }
                    });
                }).catch(function (err) { return reject(err); });
            });
        }
    };
    MQTTPubSub.prototype.unsubscribe = function (subId) {
        var _a = (this.subscriptionMap[subId] || [])[0], triggerName = _a === void 0 ? null : _a;
        var refs = this.subsRefsMap[triggerName];
        if (!refs)
            throw new Error("There is no subscription of id \"" + subId + "\"");
        var newRefs;
        if (refs.length === 1) {
            this.mqttConnection.unsubscribe(triggerName);
            newRefs = [];
        }
        else {
            var index = refs.indexOf(subId);
            if (index != -1) {
                newRefs = refs.slice(0, index).concat(refs.slice(index + 1));
            }
        }
        this.subsRefsMap[triggerName] = newRefs;
        delete this.subscriptionMap[subId];
    };
    MQTTPubSub.prototype.asyncIterator = function (triggers) {
        return new pubsub_async_iterator_1.PubSubAsyncIterator(this, triggers);
    };
    MQTTPubSub.prototype.onMessage = function (topic, message) {
        var subscribers = this.subsRefsMap[topic];
        if (!subscribers || !subscribers.length)
            return;
        var parsedMessage;
        if (this.disableMessageParse) {
            parsedMessage = message;
        }
        else {
            var messageString = message.toString(this.parseMessageWithEncoding);
            try {
                parsedMessage = JSON.parse(messageString);
            }
            catch (e) {
                parsedMessage = messageString;
            }
        }
        for (var _i = 0, subscribers_1 = subscribers; _i < subscribers_1.length; _i++) {
            var subId = subscribers_1[_i];
            var listener = this.subscriptionMap[subId][1];
            listener(parsedMessage);
        }
    };
    return MQTTPubSub;
}());
exports.MQTTPubSub = MQTTPubSub;
//# sourceMappingURL=mqtt-pubsub.js.map