import Vue from 'vue';
import { init as initSentry } from '@sentry/browser';
import { Vue as VueIntegration } from '@sentry/integrations';
import VueRouter from 'vue-router';
import VeeValidate, { Validator } from 'vee-validate';
import VModal from 'vue-js-modal';
import VueClipboard from 'vue-clipboard2';

import routes from './routes'; // eslint-disable-line
import store from './store';
import App from './App.vue';
import RoutesSiteFooter from './nav/components/RoutesSiteFooter.vue';
import NoRoutesSiteFooter from './nav/components/NoRoutesSiteFooter.vue';
import RoutesNavBar from './nav/components/RoutesNavBar.vue';
import NoRoutesNavBar from './nav/components/NoRoutesNavBar.vue';
import Icon from './components/Icon.vue';
import BaseButton from './components/BaseButton.vue';
import formatCurrency from './utils/format-currency';
import formatLongDate from './utils/format-long-date';
import formatShortDate from './utils/format-short-date';
import { logIn } from './utils/auth-actions';
import logError from './utils/log-error';
import { UnverifiedError } from './errors';

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

if (ENABLE_SENTRY) {
  initSentry({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    integrations: [new VueIntegration({ Vue })],
  });
}

Validator.localize('en', {
  custom: {
    linkEmail: {
      required: 'This field must contain a valid email address',
      email: 'This field must contain a valid email address',
    },

    email: {
      required:
        "This email field cannot be empty because it's your login for texastribune.org. Changing this email will change your login, but not your email newsletters.",
    },

    confirmedEmail: {
      required: 'Email addresses do not match',
      is: 'Email addresses do not match',
    },

    firstName: {
      required:
        'To save changes to your contact info, please complete the first and last name fields. First and last name appear in comments on texastribune.org to promote a more transparent and personable atmosphere.',
    },

    lastName: {
      required:
        'To save changes to your contact info, please complete the first and last name fields. First and last name appear in comments on texastribune.org to promote a more transparent and personable atmosphere.',
    },

    zip: {
      required:
        "To save changes to your contact info, please complete the ZIP code field. We use your ZIP code to better inform you about the issues most relevant to you and to let you know when we're hosting events in your area.",
    },
  },
});

Vue.use(VModal);
Vue.use(VueRouter);
Vue.use(VeeValidate);
Vue.use(VueClipboard);
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

  methods: { logError },
});

Vue.component('RoutesSiteFooter', RoutesSiteFooter);
Vue.component('NoRoutesSiteFooter', NoRoutesSiteFooter);
Vue.component('RoutesNavBar', RoutesNavBar);
Vue.component('NoRoutesNavBar', NoRoutesNavBar);
Vue.component('Icon', Icon);
Vue.component('BaseButton', BaseButton);

Vue.filter('currency', formatCurrency);
Vue.filter('shortDate', formatShortDate);
Vue.filter('longDate', formatLongDate);

// we refresh at a 15-minute interval instead of when
// the access token expires because we want to regularly
// check whether a user has logged out of Auth0 in another app
function refreshToken() {
  setTimeout(async () => {
    await store.dispatch('tokenUser/getTokenUser');
    const { accessToken } = store.state.tokenUser;
    if (accessToken) refreshToken();
  }, 15 * 60 * 1000); // 15 minutes
}

store.dispatch('tokenUser/getTokenUser').then(() => {
  const router = new VueRouter({
    base: '/account',
    mode: 'history',
    routes,
    scrollBehavior: () => ({ x: 0, y: 0 }),
  });

  if (store.state.tokenUser.accessToken) refreshToken();

  router.beforeEach((to, from, next) => {
    store.dispatch('context/setAppIsFetching', true);

    const {
      accessToken,
      isVerified,
      error: tokenUserError,
    } = store.state.tokenUser;

    if (to.meta.isProtected) {
      if (tokenUserError) {
        logError(tokenUserError);
        store.dispatch('context/setError', tokenUserError);
        return next();
      }
      if (!accessToken) {
        return logIn();
      }
      if (!isVerified) {
        const err = new UnverifiedError();
        logError(err);
        store.dispatch('context/setError', err);
        return next();
      }
    }

    return next();
  });

  router.afterEach(() => {
    store.dispatch('context/setAppIsFetching', false);
  });

  const instance = new Vue({ ...App, router, store });
  instance.$mount('#account-attach');
});
