#include <node.h>
#include "forger.h"
#include "cache.h"


namespace telepod {


using namespace v8;


void AssembleAll(Handle<Object> exports) {
  Forger::Assemble(exports);
  CacheWrap::Assemble(exports);
}

NODE_MODULE(hadron, AssembleAll)


} // namespace telepod
