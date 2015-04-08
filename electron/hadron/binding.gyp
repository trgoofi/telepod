{
  'targets': [
    {
      'target_name': 'hadron',
      'sources': [ 'assemble.cc', 'forger.cc', 'cache.cc' ],
      'cflags_cc': [ '-std=gnu++11' ],
      'defines': [ 'NDEBUG' ],
      'conditions': [
        ['node_shared_openssl=="false"', {
         'include_dirs': [
           '<(node_root_dir)/deps/openssl/openssl/include'
          ]
         }
        ], # node_shared_openssl
        ['OS=="mac"', {
          'xcode_settings': {
            'CLANG_CXX_LANGUAGE_STANDARD': 'gnu++11',
            'CLANG_CXX_LIBRARY': 'libc++',
            'MACOSX_DEPLOYMENT_TARGET': '10.7',
            'DEPLOYMENT_POSTPROCESSING': 'YES',
            'STRIP_INSTALLED_PRODUCT': 'YES',
            'ENABLE_NS_ASSERTIONS': 'NO'
          }, # xcode_settings
          'defines': [
            'NS_BLOCK_ASSERTIONS'
          ], # defines
        }], # OS=="mac"
      ], # conditions
    }
  ]
}
