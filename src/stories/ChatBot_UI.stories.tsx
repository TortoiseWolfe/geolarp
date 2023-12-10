import React from 'react';
import { Story, Meta } from '@storybook/react'; // Corrected import
import { ChatBot_UI } from '../components/chatbot_UI/chatbot_UI';

export default {
  title: 'Component/ChatBot_UI',
  component: ChatBot_UI,
} as Meta;

const Template: Story = (args) => <ChatBot_UI {...args} />;

export const DefaultChatBot = Template.bind({});
