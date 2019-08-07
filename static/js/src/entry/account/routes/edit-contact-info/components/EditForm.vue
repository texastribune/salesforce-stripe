<template>
  <form :key="formKey" @submit.prevent="onSubmit">
    <validation-provider
      v-slot="{ errors, flags }"
      :rules="currentFields.firstName.rules"
      :name="currentFields.firstName.name"
      immediate
    >
      <text-input
        v-model="currentFields.firstName.value"
        :error-messages="errors"
        :flags="flags"
        :name="currentFields.firstName.name"
        :label="currentFields.firstName.label"
        @updateFlags="updateFlags"
      />
    </validation-provider>
    <validation-provider
      v-slot="{ errors, flags }"
      :rules="currentFields.lastName.rules"
      :name="currentFields.lastName.name"
      immediate
    >
      <text-input
        v-model="currentFields.lastName.value"
        :error-messages="errors"
        :flags="flags"
        :name="currentFields.lastName.name"
        :label="currentFields.lastName.label"
        @updateFlags="updateFlags"
      />
    </validation-provider>
    <validation-provider
      v-slot="{ errors, flags }"
      :rules="currentFields.email.rules"
      :name="currentFields.email.name"
      immediate
    >
      <text-input
        v-model="currentFields.email.value"
        :error-messages="errors"
        :flags="flags"
        :name="currentFields.email.name"
        :label="currentFields.email.label"
        @updateFlags="updateFlags"
      >
        <p v-show="showConfirmedEmail" class="has-text-error">
          <strong>Are you sure?</strong> Changing this will log you out of your
          account, and you won't be able to log back in with
          <strong>{{ initialFields.email.value }}</strong
          >. Changing your account email will not affect your email
          subscriptions.
        </p>
        <p v-show="!showConfirmedEmail">
          Notice: This email is for logging into your account. Changing it will
          not affect your email newsletters.
        </p>
      </text-input>
    </validation-provider>
    <validation-provider
      v-show="showConfirmedEmail"
      v-slot="{ errors, flags }"
      :rules="confirmedEmailRules"
      :name="currentFields.confirmedEmail.name"
      immediate
    >
      <text-input
        v-model="currentFields.confirmedEmail.value"
        :error-messages="errors"
        :flags="flags"
        :name="currentFields.confirmedEmail.name"
        :label="currentFields.confirmedEmail.label"
        prevent-paste
        @updateFlags="updateFlags"
      />
    </validation-provider>
    <validation-provider
      v-slot="{ errors, flags }"
      :rules="currentFields.zip.rules"
      :name="currentFields.zip.name"
      immediate
    >
      <text-input
        v-model="currentFields.zip.value"
        :error-messages="errors"
        :flags="flags"
        :name="currentFields.zip.name"
        :label="currentFields.zip.label"
        @updateFlags="updateFlags"
      />
    </validation-provider>
    <validation-provider
      v-slot="{ flags }"
      :rules="currentFields.marketing.rules"
      :name="currentFields.marketing.name"
      immediate
    >
      <checkbox
        v-model="currentFields.marketing.value"
        :flags="flags"
        :name="currentFields.marketing.name"
        :label="currentFields.marketing.label"
        @updateFlags="updateFlags"
      />
    </validation-provider>
    <submit :disabled="!formIsValid" />
  </form>
</template>

<script>
import formMixin from '../../../mixins/form';

export default {
  name: 'EditContactInfoForm',

  mixins: [formMixin],

  computed: {
    emailHasChangedAndIsValid() {
      const { changed, valid } = this.currentFields.email;
      return changed && valid;
    },

    showConfirmedEmail: {
      get() {
        const { isVisible } = this.currentFields.confirmedEmail;
        return isVisible;
      },

      set(isVisible) {
        this.currentFields.confirmedEmail.isVisible = isVisible;
      },
    },

    confirmedEmailRules() {
      return { required: true, is: this.currentFields.email.value };
    },
  },

  watch: {
    emailHasChangedAndIsValid(newHasChangedAndIsValid) {
      if (newHasChangedAndIsValid) {
        this.showConfirmedEmail = true;
      } else {
        this.showConfirmedEmail = false;
        this.resetValue('confirmedEmail');
      }
    },
  },

  methods: {
    onSubmit() {
      this.$emit('onSubmit', this.currentFields);
      this.logToGtm();
    },

    logToGtm() {
      const allEvents = [];
      const baseEvent = {
        event: this.ga.customEventName,
        gaCategory: this.ga.userPortal.category,
        gaLabel: this.ga.userPortal.labels['edit-contact-info'],
      };

      if (this.currentFields.email.changed) {
        allEvents.push({
          ...baseEvent,
          gaAction: this.ga.userPortal.actions['edit-email'],
        });
      }
      if (
        this.currentFields.firstName.changed ||
        this.currentFields.lastName.changed
      ) {
        allEvents.push({
          ...baseEvent,
          gaAction: this.ga.userPortal.actions['edit-name'],
        });
      }
      if (this.currentFields.zip.changed) {
        allEvents.push({
          ...baseEvent,
          gaAction: this.ga.userPortal.actions['edit-zip'],
        });
      }

      const { changed, value } = this.currentFields.marketing;

      if (changed && value) {
        allEvents.push({
          ...baseEvent,
          gaAction: this.ga.userPortal.actions['marketing-opt-in'],
        });
      }
      if (changed && !value) {
        allEvents.push({
          ...baseEvent,
          gaAction: this.ga.userPortal.actions['marketing-opt-out'],
        });
      }

      allEvents.forEach(event => {
        window.dataLayer.push(event);
      });
    },
  },
};
</script>