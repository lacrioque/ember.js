import Stream from "ember-metal/streams/stream";
import {
  read,
  subscribe,
  isStream
} from "ember-metal/streams/utils";
import create from 'ember-metal/platform/create';
import { get } from "ember-metal/property_get";
import { isArray } from "ember-metal/utils";
import { addDependency } from "ember-metal/streams/utils";

export default function shouldDisplay(predicate) {
  if (isStream(predicate)) {
    return new ShouldDisplayStream(predicate);
  }

  var truthy = predicate && get(predicate, 'isTruthy');
  if (typeof truthy === 'boolean') { return truthy; }

  if (isArray(predicate)) {
    return get(predicate, 'length') !== 0;
  } else {
    return !!predicate;
  }
}

function ShouldDisplayStream(predicateStream) {
  this.init();
  this.oldPredicate = undefined;
  this.predicateStream = predicateStream;
  this.isTruthyStream = predicateStream.get('isTruthy');
  this.lengthStream = undefined;
  this.predicateUnsubscribe = subscribe(this.predicateStream, this.notify, this);
  this.truthyUnsubscribe = subscribe(this.isTruthyStream, this.notify, this);
  this.lengthUnsubscribe = null;
}

ShouldDisplayStream.prototype = create(Stream.prototype);

ShouldDisplayStream.prototype.valueFn = function() {
  var oldPredicate = this.oldPredicate;
  var newPredicate = read(this.predicateStream);
  var newIsArray = isArray(newPredicate);

  if (newPredicate !== oldPredicate) {

    if (this.lengthStream && !newIsArray) {
      this.lengthUnsubscribe(true);
      this.lengthStream = undefined;
    }

    if (!this.lengthStream && newIsArray) {
      this.lengthStream = this.predicateStream.get('length');
      var lengthUnsubscribe = subscribe(this.lengthStream, this.notify, this);
      if (lengthUnsubscribe) { this.lengthUnsubscribe = lengthUnsubscribe; }
    }
    this.oldPredicate = newPredicate;
  }

  var truthy = read(this.isTruthyStream);
  if (typeof truthy === 'boolean') {
    return truthy;
  }

  if (this.lengthStream) {
    var length = read(this.lengthStream);
    return length !== 0;
  }

  return !!newPredicate;
};

ShouldDisplayStream.prototype._super$destroy = Stream.prototype.destroy;

ShouldDisplayStream.prototype.destroy = function(prune) {
  if (this.state !== 'destroyed') {
    addDependency(this, this.predicateUnsubscribe);
    addDependency(this, this.truthyUnsubscribe);
    addDependency(this, this.lengthUnsubscribe);

    return this._super$destroy(prune);
  }
};
