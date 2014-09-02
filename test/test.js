var assert = require('assert'),
    fs = require('fs'),
    path = require('path'),
    sinon = require('sinon'),

    loader = require('../'),
    WebpackLoaderMock = require('./lib/WebpackLoaderMock');

function applyTemplate(source, options) {
  var requires = options && options.requireStubs || {},
      _require = sinon.spy(function (resource) {
        return requires[resource] || require(resource);
      }),
      _module = {};

  (new Function('module', 'require', source))(_module, _require);

  options.test(_module.exports(options.data), _require);
}

function loadTemplate(templatePath) {
  return fs.readFileSync(path.join(__dirname, templatePath)).toString();
}

function testTemplate(loader, template, options, testFn) {
  var resolveStubs = {};

  for (var k in options.stubs) {
    resolveStubs[k] = k;
  }

  loader.call(new WebpackLoaderMock({
    query: options.query,
    resolveStubs: resolveStubs,
    async: function (err, source) {
      if (err || !source) {
        throw new Error('Could not generate template');
      }

      applyTemplate(source, {
        data: options.data,
        requireStubs: options.stubs,
        test: testFn
      });
    }
  }), loadTemplate(template));
}

describe('handlebars-loader', function () {

  it('should load simple handlebars templates', function (done) {
    testTemplate(loader, './simple.handlebars', {
      data: {
        title: 'This is the title',
        description: 'This is the description'
      }
    }, function (output, require) {
      assert.ok(output, 'generated output');
      // There will actually be 1 require for the main handlebars runtime library
      assert.equal(require.callCount, 1,
        'should not have required anything extra');
      done();
    });
  });

  it('should convert helpers into require statements', function (done) {
    testTemplate(loader, './with-helpers.handlebars', {
      stubs: {
        'title': function (text) { return 'Title: ' + text; },
        './description': function (text) { return 'Description: ' + text; }
      },
      data: {
        title: 'This is the title',
        description: 'This is the description'
      }
    }, function (output, require) {
      assert.ok(output, 'generated output');
      assert.ok(require.calledWith('title'),
        'should have loaded helper with module syntax');
      assert.ok(require.calledWith('./description'),
        'should have loaded helper with relative syntax');
      done();
    });
  });

  it('should convert partials into require statements', function (done) {
    testTemplate(loader, './with-partials.handlebars', {
      stubs: {
        './partial': require('./partial.handlebars'),
        'partial': require('./partial.handlebars')
      },
      data: {
        title: 'This is the title',
        description: 'This is the description'
      }
    }, function (output, require) {
      assert.ok(output, 'generated output');
      assert.ok(require.calledWith('partial'),
        'should have loaded partial with module syntax');
      assert.ok(require.calledWith('./partial'),
        'should have loaded partial with relative syntax');
      done();
    });
  });

  it('allows specifying additional helper search directories', function (done) {
    testTemplate(loader, './with-dir-helpers.handlebars', {
      query: '?helperDirs[]=' + path.join(__dirname, 'helpers'),
      data: {
        image: 'http://www.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50'
      }
    }, function (output, require) {
      assert.ok(output, 'generated output');
      done();
    });
  });

});
