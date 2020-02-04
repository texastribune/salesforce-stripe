import Vue from 'vue';
import VueRouter from 'vue-router';
import VModal from 'vue-js-modal';
import { extend as extendValidationRule } from 'vee-validate';
import {
  required as requiredRule,
  email as emailRule,
  numeric as numericRule,
} from 'vee-validate/dist/rules';
import VueClipboard from 'vue-clipboard2';
import axios from 'axios';
import { Vue as VueIntegration } from '@sentry/integrations';
import { init as initSentry, setExtra } from '@sentry/browser';

import routes from './routes';
import store from './store';
import App from './App.vue';
import UserSiteFooter from './nav/components/UserSiteFooter.vue';
import BasicSiteFooter from './nav/components/BasicSiteFooter.vue';
import UserNavBar from './nav/components/UserNavBar.vue';
import BasicNavBar from './nav/components/BasicNavBar.vue';
import UserInternalNav from './nav/components/UserInternalNav.vue';
import Icon from './components/Icon.vue';
import BaseButton from './components/BaseButton.vue';
import formatCurrency from './utils/format-currency';
import formatLongDate from './utils/format-long-date';
import formatShortDate from './utils/format-short-date';
import { logIn } from './utils/auth-actions';
import logError from './utils/log-error';
import {
  UnverifiedError,
  AxiosResponseError,
  AxiosRequestError,
} from './errors';
import {
  SENTRY_DSN,
  SENTRY_ENVIRONMENT,
  ENABLE_SENTRY,
  GA_USER_PORTAL_NAV,
  GA_USER_PORTAL,
  GA_DONATIONS,
  GA_BLAST_INTENT,
  GA_TRIBUNE_AMBASSADORS,
  GA_AMBASSADORS_CUSTOM_EVENT_NAME,
  GA_CUSTOM_EVENT_NAME,
  DONATE_URL,
  CIRCLE_URL,
} from './constants';
import {
  CONTEXT_TYPES,
  CONTEXT_MODULE,
  TOKEN_USER_TYPES,
  TOKEN_USER_MODULE,
} from './store/types';

if (ENABLE_SENTRY) {
  initSentry({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    integrations: [new VueIntegration({ Vue })],
  });
}

Vue.mixin({
  data() {
    return {
      ga: {
        userPortal: GA_USER_PORTAL,
        userPortalNav: GA_USER_PORTAL_NAV,
        donations: GA_DONATIONS,
        blastIntent: GA_BLAST_INTENT,
        tribuneAmbassadors: GA_TRIBUNE_AMBASSADORS,
        customEventName: GA_CUSTOM_EVENT_NAME,
        ambassadorsCustomEventName: GA_AMBASSADORS_CUSTOM_EVENT_NAME,
      },
      donateUrl: DONATE_URL,
      circleUrl: CIRCLE_URL,
    };
  },
});

Vue.use(VModal);
Vue.use(VueRouter);
Vue.use(VueClipboard);

Vue.component('UserSiteFooter', UserSiteFooter);
Vue.component('BasicSiteFooter', BasicSiteFooter);
Vue.component('UserNavBar', UserNavBar);
Vue.component('BasicNavBar', BasicNavBar);
Vue.component('UserInternalNav', UserInternalNav);
Vue.component('Icon', Icon);
Vue.component('BaseButton', BaseButton);

Vue.filter('currency', formatCurrency);
Vue.filter('shortDate', formatShortDate);
Vue.filter('longDate', formatLongDate);

extendValidationRule('email', emailRule);
extendValidationRule('required', requiredRule);
extendValidationRule('numeric', numericRule);
extendValidationRule('confirm', {
  params: ['target'],

  validate(value, { target }) {
    return value === target;
  },
});

axios.interceptors.response.use(
  response => response,
  error => {
    let meta = { extra: error.toJSON() };

    if (error.response) {
      const { status, data, headers } = error.response;
      meta = { ...meta, status, data, headers };
    }

    setExtra('lastAxiosResponse', meta);

    return Promise.reject(new AxiosResponseError(meta));
  }
);

axios.interceptors.request.use(
  config => config,
  error => {
    const meta = { extra: error.toJSON() };

    setExtra('lastAxiosRequest', meta);

    return Promise.reject(new AxiosRequestError(meta));
  }
);

// we refresh at a 15-minute interval instead of when
// the access token expires because we want to regularly
// check whether a user has logged out of Auth0 in another app
function refreshToken() {
  setTimeout(async () => {
    await store.dispatch(
      `${TOKEN_USER_MODULE}/${TOKEN_USER_TYPES.getTokenUser}`
    );

    const isLoggedIn = store.getters[`${TOKEN_USER_MODULE}/isLoggedIn`];

    if (isLoggedIn) refreshToken();
  }, 15 * 60 * 1000);
}

store
  .dispatch(`${TOKEN_USER_MODULE}/${TOKEN_USER_TYPES.getTokenUser}`)
  .then(() => {
    const isLoggedIn = store.getters[`${TOKEN_USER_MODULE}/isLoggedIn`];
    const router = new VueRouter({
      base: '/account',
      mode: 'history',
      routes,
      scrollBehavior(to, from, savedPosition) {
        if (savedPosition) {
          return savedPosition;
        }
        return { x: 0, y: 0 };
      },
    });

    if (isLoggedIn) {
      refreshToken();
    }

    router.beforeEach((to, from, next) => {
      store.dispatch(`${CONTEXT_MODULE}/${CONTEXT_TYPES.setIsFetching}`, true);

      // eslint-disable-next-line no-shadow
      const isLoggedIn = store.getters[`${TOKEN_USER_MODULE}/isLoggedIn`];
      const isVerified = store.getters[`${TOKEN_USER_MODULE}/isVerified`];
      const { error: tokenUserError } = store.state[TOKEN_USER_MODULE];

      if (to.meta.isProtected) {
        if (tokenUserError) {
          logError(tokenUserError);

          store.dispatch(
            `${CONTEXT_MODULE}/${CONTEXT_TYPES.setError}`,
            tokenUserError
          );

          return next();
        }

        if (!isLoggedIn) {
          return logIn();
        }

        if (!isVerified) {
          store.dispatch(
            `${CONTEXT_MODULE}/${CONTEXT_TYPES.setError}`,
            new UnverifiedError()
          );

          return next();
        }
      }

      return next();
    });

    router.afterEach(() => {
      store.dispatch(`${CONTEXT_MODULE}/${CONTEXT_TYPES.setIsFetching}`, false);
    });

    const instance = new Vue({ ...App, router, store });

    instance.$mount('#account-attach');
  });
